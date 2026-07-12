import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const patchTimeLogSchema = z
  .object({
    minutes: z.number().int().positive().max(1440, "A single entry can't exceed 24 hours (1440 minutes)."),
    user_id: z.string().uuid("user_id must be the Forge user id (not an email) of who the time is attributed to."),
    note: z.string().max(2000).nullable(),
    billable: z.boolean(),
    tag: z.string().max(100).nullable(),
    logged_at: z.string().datetime(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });

/** Confirms {logId} actually belongs to this tenant + issue before any PATCH/DELETE touches it. */
async function loadOwnedLog(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  issueId: string,
  logId: string
) {
  const { data } = await supabase
    .from("issue_time_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("issue_id", issueId)
    .eq("id", logId)
    .maybeSingle();
  return data;
}

/** PATCH /api/v1/issues/{id}/time-logs/{logId} — edit a time log (scope: issues:write). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_WRITE);
    if (gate.error) return gate.error;
    const { id, logId } = await params;
    const { tenantId } = gate.auth;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("invalid_request", "Body must be valid JSON.");
    }
    const parsed = patchTimeLogSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid_request", "Validation failed.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const input = parsed.data;

    const supabase = createSupabaseServiceClient();
    const existing = await loadOwnedLog(supabase, tenantId, id, logId);
    if (!existing) return apiError("not_found", "Time log not found on this issue.");

    if (input.user_id !== undefined) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", input.user_id)
        .maybeSingle();
      if (!membership) return apiError("invalid_request", "user_id is not a member of this workspace.");
    }

    const { data: log, error } = await supabase
      .from("issue_time_logs")
      .update({
        ...(input.minutes !== undefined ? { minutes: input.minutes } : {}),
        ...(input.user_id !== undefined ? { user_id: input.user_id } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.billable !== undefined ? { billable: input.billable } : {}),
        ...(input.tag !== undefined ? { tag: input.tag } : {}),
        ...(input.logged_at !== undefined ? { logged_at: input.logged_at } : {}),
      })
      .eq("tenant_id", tenantId)
      .eq("id", logId)
      .select("id, user_id, minutes, note, billable, tag, logged_at, created_at")
      .single();
    if (error) throw error;

    return apiOk(log);
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("PATCH /api/v1/issues/[id]/time-logs/[logId] unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}

/** DELETE /api/v1/issues/{id}/time-logs/{logId} — remove a time log (scope: issues:write). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; logId: string }> }) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_WRITE);
    if (gate.error) return gate.error;
    const { id, logId } = await params;
    const { tenantId } = gate.auth;

    const supabase = createSupabaseServiceClient();
    const existing = await loadOwnedLog(supabase, tenantId, id, logId);
    if (!existing) return apiError("not_found", "Time log not found on this issue.");

    const { error } = await supabase.from("issue_time_logs").delete().eq("tenant_id", tenantId).eq("id", logId);
    if (error) throw error;

    return apiOk({ deleted: true });
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("DELETE /api/v1/issues/[id]/time-logs/[logId] unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}
