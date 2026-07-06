import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: search bypasses RLS but explicit tenant_id filter enforces isolation (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type ParsedQuery = {
  text: string;
  filters: {
    status?: string[];
    priority?: string[];
    type?: string[];
    assignee?: string; // "me" or user id
    project?: string;  // project key prefix e.g. "WEB"
  };
};

/**
 * Parse a query string with optional filter operators.
 * Supported: status:, priority:, type:, assignee:, project:
 * Multiple values for same key use comma or repeated key: status:todo,in_progress
 * Example: "login bug status:todo priority:high type:bug"
 */
function parseQuery(raw: string): ParsedQuery {
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

/**
 * GET /api/search?slug=<tenant>&q=<query>&limit=8
 * Session-authenticated cross-tenant search for the command palette.
 * Supports query language: status:, priority:, type:, assignee:, project:
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const raw = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20);

  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!raw) return NextResponse.json({ data: [] });

  const { text, filters } = parseQuery(raw);
  const svc = createSupabaseServiceClient();

  // Build issue query
  let query = svc
    .from("issues")
    .select("id, number, title, status, priority, type, project_id, assignee_id")
    .eq("tenant_id", ctx.tenant.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  // Sanitize free-text before interpolating into PostgREST filter string.
  // Periods, parens, and commas are PostgREST syntax characters that can escape the filter.
  if (text) {
    const safe = text.replace(/[^a-zA-Z0-9 \-_]/g, ""); // single-quote removed: PostgREST treats it as string delimiter
    if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (filters.status)    query = query.in("status", filters.status);
  if (filters.priority)  query = query.in("priority", filters.priority);
  if (filters.type)      query = query.in("type", filters.type);

  const { data: issues, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve project keys
  const projectIds = [...new Set((issues ?? []).map((r) => r.project_id as string))];
  const { data: projects } = projectIds.length
    ? await svc.from("projects").select("id, key").eq("tenant_id", ctx.tenant.id).in("id", projectIds)
    : { data: [] };
  const keyMap = Object.fromEntries((projects ?? []).map((p) => [p.id as string, p.key as string]));

  // Filter by project key if specified
  let filtered = (issues ?? []).filter((r) => {
    if (filters.project) return (keyMap[r.project_id as string] ?? "").toUpperCase() === filters.project;
    return true;
  });

  // Filter by assignee — "me" = current user, otherwise user id / name match (simple prefix)
  if (filters.assignee) {
    if (filters.assignee === "me") {
      filtered = filtered.filter((r) => r.assignee_id === ctx.appUserId);
    } else {
      // Try to look up user by name or email prefix
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

  const results = filtered.map((r) => ({
    id: r.id,
    key: `${keyMap[r.project_id as string] ?? "??"}-${r.number}`,
    title: r.title,
    status: r.status,
    priority: r.priority,
    type: r.type,
  }));

  return NextResponse.json({ data: results });
}
