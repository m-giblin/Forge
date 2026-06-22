"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role bulk update: tenant_id injected explicitly on every query (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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

  const dbPatch: Record<string, unknown> = {};
  if (patch.status     !== undefined) dbPatch.status      = patch.status;
  if (patch.priority   !== undefined) dbPatch.priority    = patch.priority;
  if (patch.type       !== undefined) dbPatch.type        = patch.type;
  if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
  if (patch.phase      !== undefined) dbPatch.phase       = patch.phase;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("issues")
    .update(dbPatch)
    .eq("tenant_id", ctx.tenant.id)
    .in("id", ids);

  if (error) throw new Error(error.message);

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
