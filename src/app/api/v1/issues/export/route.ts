import { enforce } from "@/lib/api/gate";
import { SCOPES } from "@/lib/api/scopes";
import { apiError } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const COLS = [
  "id", "number", "project_id", "title", "description", "type", "status",
  "priority", "assignee_id", "phase", "start_date", "due_date",
  "created_at", "updated_at", "external_id", "source",
];

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
}

/** GET /api/v1/issues/export — stream all issues as CSV (scope: issues:read). */
export async function GET(req: Request) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_READ);
    if (gate.error) return gate.error;
    const { tenantId } = gate.auth;

    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const priority = url.searchParams.get("priority") ?? undefined;

    const supabase = createSupabaseServiceClient();
    let q = supabase.from("issues").select(COLS.join(",")).eq("tenant_id", tenantId).order("created_at");
    if (projectId) q = q.eq("project_id", projectId);
    if (status)    q = q.eq("status", status);
    if (priority)  q = q.eq("priority", priority);

    const { data: rawData, error } = await q;
    if (error) throw error;
    const data = (rawData as unknown as Record<string, unknown>[]) ?? [];

    // Resolve project keys and assignee labels for human-readable output
    const projectIds = [...new Set((data ?? []).map((r) => r.project_id as string))];
    const assigneeIds = [...new Set((data ?? []).map((r) => r.assignee_id as string | null).filter(Boolean))] as string[];

    const [projectsRes, usersRes] = await Promise.all([
      projectIds.length > 0
        ? supabase.from("projects").select("id,key").in("id", projectIds)
        : Promise.resolve({ data: [] }),
      assigneeIds.length > 0
        ? supabase.from("users").select("id,name").in("id", assigneeIds)
        : Promise.resolve({ data: [] }),
    ]);

    const projectKey = new Map((projectsRes.data ?? []).map((p) => [p.id, p.key]));
    // name only — never expose member emails to API key holders (issues:read scope = minimal privilege)
    const userName = new Map((usersRes.data ?? []).map((u) => [u.id, u.name ?? "Unknown"]));

    // external_id is excluded: it stores raw sender email for inbound-email issues, which
    // would leak PII (email addresses) to any API key holder with issues:read scope.
    const headers = ["key", "title", "description", "type", "status", "priority", "assignee", "phase", "start_date", "due_date", "created_at", "updated_at", "source"];
    const rows = (data ?? []).map((r) => [
      `${projectKey.get(r.project_id as string) ?? "??"}-${r.number}`,
      r.title,
      r.description,
      r.type,
      r.status,
      r.priority,
      r.assignee_id ? userName.get(r.assignee_id as string) ?? r.assignee_id : "",
      r.phase,
      r.start_date,
      r.due_date,
      r.created_at,
      r.updated_at,
      r.source,
    ].map(csvEscape).join(","));

    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="issues.csv"',
      },
    });
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("GET /api/v1/issues/export unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}
