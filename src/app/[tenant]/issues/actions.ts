"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role delete: tenant_id injected explicitly (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { updateIssue } from "@/lib/services/issues";
import type { IssuePatch } from "@/lib/services/issues";

export type BulkPatch = {
  status?:     string;
  priority?:   string;
  type?:       string;
  assigneeId?: string | null;
  phase?:      string | null;
};

export async function bulkUpdateIssuesAction(slug: string, ids: string[], patch: BulkPatch) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues.");
  if (ids.length === 0) return;

  const issuePatch: IssuePatch = {};
  if (patch.status     !== undefined) issuePatch.status      = patch.status;
  if (patch.priority   !== undefined) issuePatch.priority    = patch.priority;
  if (patch.type       !== undefined) issuePatch.type        = patch.type;
  if (patch.assigneeId !== undefined) issuePatch.assigneeId  = patch.assigneeId;
  if (patch.phase      !== undefined) issuePatch.phase       = patch.phase;

  const actor = { userId: ctx.appUserId, label: ctx.email ?? null };
  const results = await Promise.allSettled(
    ids.map((id) => updateIssue(ctx.tenant.id, id, issuePatch, actor))
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    throw new Error(`${failed.length} of ${ids.length} issues failed to update.`);
  }

  revalidatePath(`/${slug}/issues`);
  revalidatePath(`/${slug}/board`);
}

export async function bulkDeleteIssuesAction(slug: string, ids: string[]) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!ctxCanDo(ctx, "delete_issues")) throw new Error("You don't have permission to delete issues.");
  if (ids.length === 0) return;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("issues")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .in("id", ids);

  if (error) throw new Error(error.message);

  revalidatePath(`/${slug}/issues`);
  revalidatePath(`/${slug}/board`);
}
