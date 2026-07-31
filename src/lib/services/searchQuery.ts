import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantContext } from "@/lib/auth";

export type ParsedQuery = {
  text: string;
  filters: {
    status?: string[];
    priority?: string[];
    type?: string[];
    assignee?: string; // "me" or a name/email prefix
    project?: string;  // project key prefix e.g. "WEB"
  };
};

export type SearchResultIssue = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  assignee: string | null;
  updatedAt?: string;
};

/**
 * Parse a query string with optional filter operators.
 * Supported: status:, priority:, type:, assignee:, project:
 * Multiple values for same key use comma or repeated key: status:todo,in_progress
 * Example: "login bug status:todo priority:high type:bug"
 *
 * Single implementation shared by /api/search (command palette, small result
 * set) and /api/search/advanced (the Advanced Search page, full results) —
 * Advanced Search's AQL syntax (`field = "value"`) is a different way of
 * writing the exact same query, translated by parseAql() below into this
 * same token string before being parsed here. There is deliberately only one
 * filtering implementation, not two parallel ones.
 */
export function parseQuery(raw: string): ParsedQuery {
  const filters: ParsedQuery["filters"] = {};
  const textParts: string[] = [];

  const TOKEN_RE = /(\w+):([\w,_]+)/g;
  let match: RegExpExecArray | null;
  const tokenPositions: [number, number][] = [];

  while ((match = TOKEN_RE.exec(raw)) !== null) {
    const [full, key, value] = match;
    tokenPositions.push([match.index, match.index + full!.length]);
    const vals = value!.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
    if (key === "status")   { filters.status   = [...(filters.status   ?? []), ...vals]; }
    if (key === "priority") { filters.priority = [...(filters.priority ?? []), ...vals]; }
    if (key === "type")     { filters.type     = [...(filters.type     ?? []), ...vals]; }
    if (key === "assignee") { filters.assignee = vals[0]; }
    if (key === "project")  { filters.project  = vals[0]?.toUpperCase(); }
  }

  // Extract text that's not part of a filter token
  let cursor = 0;
  for (const [start, end] of tokenPositions) {
    if (cursor < start) textParts.push(raw.slice(cursor, start));
    cursor = end;
  }
  if (cursor < raw.length) textParts.push(raw.slice(cursor));

  const text = textParts.join(" ").replace(/\s+/g, " ").trim();
  return { text, filters };
}

const AQL_FIELDS = new Set(["status", "priority", "type", "assignee", "project"]);

/**
 * Translates Advanced Search's AQL syntax — `field = "value" AND field =
 * "value"` — into the token string parseQuery() already understands
 * (`field:value field:value`). AQL is purely a different way of *writing*
 * the same query the command palette's filter tokens already express; this
 * function is the only place that syntax gets interpreted, and everything
 * downstream of it (parsing, execution) is shared with /api/search.
 *
 * Unrecognized field names are folded back in as plain free text rather than
 * erroring — a typo'd field shouldn't return zero results with no
 * explanation, and free-text search over it is a reasonable fallback.
 */
export function parseAql(raw: string): string {
  const CLAUSE_RE = /(\w+)\s*=\s*"([^"]*)"/g;
  const tokenPositions: [number, number][] = [];
  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = CLAUSE_RE.exec(raw)) !== null) {
    const [full, field, value] = match;
    tokenPositions.push([match.index, match.index + full!.length]);
    const key = field!.toLowerCase();
    if (AQL_FIELDS.has(key) && value!.trim()) {
      tokens.push(`${key}:${value!.trim().replace(/\s+/g, "_")}`);
    } else if (value!.trim()) {
      tokens.push(value!.trim());
    }
  }

  // Whatever's left over (connectors like AND/OR, unmatched text) becomes
  // free text — same "leftover = plain text" approach parseQuery uses.
  let cursor = 0;
  const leftover: string[] = [];
  for (const [start, end] of tokenPositions) {
    if (cursor < start) leftover.push(raw.slice(cursor, start));
    cursor = end;
  }
  if (cursor < raw.length) leftover.push(raw.slice(cursor));

  const freeText = leftover
    .join(" ")
    .replace(/\b(and|or)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [...tokens, freeText].filter(Boolean).join(" ");
}

/**
 * Shared execution: builds and runs the actual issue query for a parsed
 * search string. `limit` and `includeExtra` are the only things that differ
 * between the command palette (/api/search — small, fast, minimal fields)
 * and Advanced Search (/api/search/advanced — full results table).
 */
export async function runSearchQuery(
  ctx: TenantContext,
  svc: SupabaseClient,
  raw: string,
  opts: { limit: number; includeExtra?: boolean }
): Promise<SearchResultIssue[]> {
  const { text, filters } = parseQuery(raw);
  const { limit, includeExtra = false } = opts;

  // One literal select string used by both callers (rather than a variable
  // built conditionally) — Supabase's typed query builder parses the select
  // string at compile time and can't resolve a non-literal/branching one.
  // The extra join is cheap enough at these result caps (≤200 rows) that
  // there's no real cost to always fetching it, even for the command
  // palette's smaller/faster path.
  let query = svc
    .from("issues")
    .select("id, number, title, status, priority, type, project_id, assignee_id, updated_at, users!issues_assignee_id_fkey(name, email)")
    .eq("tenant_id", ctx.tenant.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  // Sanitize free-text before interpolating into PostgREST filter string.
  // Periods, parens, and commas are PostgREST syntax characters that can escape the filter.
  const safeText = text ? text.replace(/[^a-zA-Z0-9 \-]/g, "") : "";
  if (safeText) {
    query = query.or(`title.ilike.%${safeText}%,description.ilike.%${safeText}%`);
  }
  if (filters.status)    query = query.in("status", filters.status);
  if (filters.priority)  query = query.in("priority", filters.priority);
  if (filters.type)      query = query.in("type", filters.type);

  const { data: titleDescMatches, error } = await query;
  if (error) throw new Error(error.message);

  // Also match comment bodies — a match on a comment surfaces its parent issue.
  let commentMatches: typeof titleDescMatches = [];
  if (safeText) {
    const { data: commentRows } = await svc
      .from("issue_comments")
      .select("issue_id")
      .eq("tenant_id", ctx.tenant.id)
      .ilike("body", `%${safeText}%`)
      .limit(limit);
    const commentIssueIds = [...new Set((commentRows ?? []).map((r) => r.issue_id as string))];
    if (commentIssueIds.length) {
      let commentIssueQuery = svc
        .from("issues")
        .select("id, number, title, status, priority, type, project_id, assignee_id, updated_at, users!issues_assignee_id_fkey(name, email)")
        .eq("tenant_id", ctx.tenant.id)
        .in("id", commentIssueIds)
        .limit(limit);
      if (filters.status)    commentIssueQuery = commentIssueQuery.in("status", filters.status);
      if (filters.priority)  commentIssueQuery = commentIssueQuery.in("priority", filters.priority);
      if (filters.type)      commentIssueQuery = commentIssueQuery.in("type", filters.type);
      const { data } = await commentIssueQuery;
      commentMatches = data ?? [];
    }
  }

  const seen = new Set<string>();
  const issues = [...(titleDescMatches ?? []), ...commentMatches]
    .filter((r) => (seen.has(r.id as string) ? false : (seen.add(r.id as string), true)))
    .slice(0, limit);

  const projectIds = [...new Set(issues.map((r) => r.project_id as string))];
  const { data: projects } = projectIds.length
    ? await svc.from("projects").select("id, key").eq("tenant_id", ctx.tenant.id).in("id", projectIds)
    : { data: [] };
  const keyMap = Object.fromEntries((projects ?? []).map((p) => [p.id as string, p.key as string]));

  let filtered = issues.filter((r) => {
    if (filters.project) return (keyMap[r.project_id as string] ?? "").toUpperCase() === filters.project;
    return true;
  });

  if (filters.assignee) {
    if (filters.assignee === "me") {
      filtered = filtered.filter((r) => r.assignee_id === ctx.appUserId);
    } else {
      const { data: matchedUsers } = await svc
        .from("users")
        .select("id")
        .eq("tenant_id", ctx.tenant.id)
        .ilike("name", `${filters.assignee}%`)
        .limit(5);
      const matchedIds = new Set((matchedUsers ?? []).map((u) => u.id as string));
      filtered = filtered.filter((r) => r.assignee_id && matchedIds.has(r.assignee_id as string));
    }
  }

  return filtered.map((r) => {
    const userObj = r.users as unknown;
    const user = Array.isArray(userObj) ? userObj[0] : (userObj as { name?: string; email?: string } | null);
    return {
      id: r.id as string,
      key: `${keyMap[r.project_id as string] ?? "??"}-${r.number}`,
      title: r.title as string,
      status: r.status as string,
      priority: r.priority as string,
      type: r.type as string,
      assignee: includeExtra ? (user?.name ?? user?.email ?? null) : null,
      updatedAt: includeExtra ? (r.updated_at as string) : undefined,
    };
  });
}
