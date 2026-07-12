import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo } from "@/lib/repositories/issues";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const logTimeSchema = z.object({
  minutes: z.number().int().positive().max(1440, "A single entry can't exceed 24 hours (1440 minutes)."),
  user_id: z.string().uuid("user_id must be the Forge user id (not an email) of who the time is attributed to."),
  note: z.string().max(2000).optional(),
  billable: z.boolean().optional(),
  tag: z.string().max(100).optional(),
  logged_at: z.string().datetime().optional(),
});

/** GET /api/v1/issues/{id}/time-logs — list time logs on an issue (scope: issues:read). */
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
      .select("id, user_id, minutes, note, billable, tag, logged_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("issue_id", id)
      .order("logged_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    return apiOk(data ?? []);
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

/** POST /api/v1/issues/{id}/time-logs — log time on an issue (scope: issues:write). */
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
    const parsed = logTimeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid_request", "Validation failed.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const input = parsed.data;

    const supabase = createSupabaseServiceClient();

    const issue = await issuesRepo(supabase).get(tenantId, id);
    if (!issue) return apiError("not_found", "Issue not found.");

    // user_id must be a real member of THIS tenant — never trust it blindly,
    // it's the one place this endpoint could otherwise attribute time to an
    // arbitrary user id from another workspace.
    const { data: membership } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", input.user_id)
      .maybeSingle();
    if (!membership) return apiError("invalid_request", "user_id is not a member of this workspace.");

    const { data: log, error } = await supabase
      .from("issue_time_logs")
      .insert({
        tenant_id: tenantId,
        issue_id: id,
        user_id: input.user_id,
        minutes: input.minutes,
        note: input.note ?? null,
        billable: input.billable ?? false,
        tag: input.tag ?? null,
        ...(input.logged_at ? { logged_at: input.logged_at } : {}),
      })
      .select("id, user_id, minutes, note, billable, tag, logged_at, created_at")
      .single();
    if (error) throw error;

    return apiOk(log, 201);
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
