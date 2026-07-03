"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- tenant admin self-override: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function setSelfOverrideAction(slug: string, featureKey: string, enabled: boolean) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Forbidden — owner or admin only");

  const svc = createSupabaseServiceClient();

  if (enabled) {
    // Re-enabling = remove the self-override (let the plan default take over)
    const { error } = await svc
      .from("tenant_self_overrides")
      .delete()
      .eq("tenant_id", ctx.tenant.id)
      .eq("feature_key", featureKey);
    if (error) throw error;
  } else {
    // Disabling = insert/upsert self-override with enabled=false
    const { error } = await svc
      .from("tenant_self_overrides")
      .upsert(
        { tenant_id: ctx.tenant.id, feature_key: featureKey, enabled: false },
        { onConflict: "tenant_id,feature_key" }
      );
    if (error) throw error;
  }

  revalidatePath(`/${slug}/admin/features`);
}
