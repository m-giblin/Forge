import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo } from "@/lib/repositories/issues";
import { fireWebhook } from "@/lib/services/webhooks";
import { runAutomations } from "@/lib/services/automation";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bulkPatchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  patch: z.object({
    status:     z.string().optional(),
    priority:   z.string().optional(),
    type:       z.string().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    phase:      z.string().nullable().optional(),
  }).refine((p) => Object.keys(p).length > 0, { message: "patch must have at least one field" }),
});

/** PATCH /api/v1/issues/bulk — update multiple issues in one call (scope: issues:write). */
export async function PATCH(req: Request) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_WRITE);
    if (gate.error) return gate.error;
    const { tenantId } = gate.auth;

    let body: unknown;
    try { body = await req.json(); } catch {
      return apiError("invalid_request", "Body must be valid JSON.");
    }

    const parsed = bulkPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid_request", "Validation failed.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const { ids, patch } = parsed.data;

    const supabase = createSupabaseServiceClient();
    const repo = issuesRepo(supabase);

    // Snapshot before state so we can detect field changes for side-effects
    const before = await Promise.all(ids.map((id) => repo.get(tenantId, id)));

    // Build DB patch — map camelCase → snake_case
    const dbPatch: Record<string, unknown> = {};
    if (patch.status     !== undefined) dbPatch.status      = patch.status;
    if (patch.priority   !== undefined) dbPatch.priority    = patch.priority;
    if (patch.type       !== undefined) dbPatch.type        = patch.type;
    if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
    if (patch.phase      !== undefined) dbPatch.phase       = patch.phase;

    // Service-role: we must scope to tenant_id explicitly
    const { error, count } = await supabase
      .from("issues")
      .update(dbPatch)
      .eq("tenant_id", tenantId)
      .in("id", ids);

    if (error) throw error;

    // Fire side-effects per issue (best-effort — never fail the response)
    const updated = await Promise.all(ids.map((id) => repo.get(tenantId, id)));
    for (let i = 0; i < updated.length; i++) {
      const after = updated[i];
      const pre   = before[i];
      if (!after) continue;
      void fireWebhook(tenantId, "issue.updated", { issue: after });
      if (patch.status !== undefined && pre?.status !== patch.status) {
        void runAutomations(tenantId, "issue.status_changed", after);
      }
      if (patch.assigneeId !== undefined && pre?.assignee_id !== patch.assigneeId) {
        void runAutomations(tenantId, "issue.assigned", after);
      }
    }

    return apiOk({ updated: count ?? ids.length });
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("PATCH /api/v1/issues/bulk unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}
