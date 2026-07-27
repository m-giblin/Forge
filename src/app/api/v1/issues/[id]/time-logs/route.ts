import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo } from "@/lib/repositories/issues";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const timeLogSchema = z.object({
  user_id: z.string().uuid(),
  minutes: z.number().int().positive(),
  note: z.string().max(2000).optional(),
  billable: z.boolean().optional(),
  tag: z.string().max(100).optional(),
  logged_at: z.string().datetime().optional(),
});

/** GET /api/v1/issues/{id}/time-logs — list time logs, newest first (scope: issues:read). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_READ);
    if (gate.error) return gate.error;
    const { id } = await params;
    const { tenantId } = gate.auth;

    const supabase = createSupabaseServiceClient();

    const issue = await issuesRepo(supabase).get(tenantId, id);
    if (!issue) return apiError("not_found", "Issue not found.");

    const { data, error } = await supabase
      .from("issue_time_logs")
      .select("id, user_id, minutes, note, billable, tag, logged_at, users(name)")
      .eq("tenant_id", tenantId)
      .eq("issue_id", id)
      .order("logged_at", { ascending: false });
    if (error) throw error;

    return apiOk({
      time_logs: (data ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        user_name: (Array.isArray(r.users) ? r.users[0]?.name : (r.users as { name: string | null } | null)?.name) ?? null,
        minutes: r.minutes,
        note: r.note,
        billable: r.billable,
        tag: r.tag,
        logged_at: r.logged_at,
      })),
    });
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("GET /api/v1/issues/[id]/time-logs unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}

/** POST /api/v1/issues/{id}/time-logs — log time against an issue (scope: issues:write). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_WRITE);
    if (gate.error) return gate.error;
    const { id } = await params;
    const { tenantId } = gate.auth;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("invalid_request", "Body must be valid JSON.");
    }
    const parsed = timeLogSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid_request", "Validation failed.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    const supabase = createSupabaseServiceClient();

    const issue = await issuesRepo(supabase).get(tenantId, id);
    if (!issue) return apiError("not_found", "Issue not found.");

    // Isolation: issue_time_logs.user_id is NOT NULL + FK'd — the attributed
    // user must be a member of this tenant, same check used for assignees.
    const { data: membership } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", parsed.data.user_id)
      .maybeSingle();
    if (!membership) {
      return apiError("invalid_request", "user_id is not a member of this workspace.");
    }

    const { data: log, error } = await supabase
      .from("issue_time_logs")
      .insert({
        tenant_id: tenantId,
        issue_id: id,
        user_id: parsed.data.user_id,
        minutes: parsed.data.minutes,
        note: parsed.data.note?.trim() || null,
        billable: parsed.data.billable ?? false,
        tag: parsed.data.tag ?? null,
        ...(parsed.data.logged_at ? { logged_at: parsed.data.logged_at } : {}),
      })
      .select("id, user_id, minutes, note, billable, tag, logged_at")
      .single();
    if (error) throw error;

    return apiOk({ time_log: log }, 201);
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("POST /api/v1/issues/[id]/time-logs unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}
