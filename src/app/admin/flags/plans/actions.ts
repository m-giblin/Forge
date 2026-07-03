"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function setPlanTierFeatureAction(planKey: string, featureKey: string, included: boolean) {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("plan_tier_features")
    .upsert({ plan_key: planKey, feature_key: featureKey, included }, { onConflict: "plan_key,feature_key" });
  if (error) throw error;
  revalidatePath("/admin/flags/plans");
}

export async function setPlanActiveAction(planKey: string, isActive: boolean) {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("plan_tiers")
    .update({ is_active: isActive })
    .eq("key", planKey);
  if (error) throw error;
  revalidatePath("/admin/flags/plans");
}

export async function applyPlanToTenantsAction(
  planKey: string,
  featureKey: string,
  included: boolean
): Promise<{ applied: number; skipped: number }> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();

  // Get all tenants on this plan
  const { data: tenants } = await svc
    .from("tenants")
    .select("id")
    .eq("plan", planKey);

  if (!tenants || tenants.length === 0) return { applied: 0, skipped: 0 };

  // Get tenants that already have a super-admin override for this key (skip them)
  const tenantIds = tenants.map((t) => t.id as string);
  const { data: existing } = await svc
    .from("tenant_feature_overrides")
    .select("tenant_id")
    .eq("key", featureKey)
    .in("tenant_id", tenantIds);

  const alreadyOverridden = new Set((existing ?? []).map((r) => r.tenant_id as string));
  const toApply = tenantIds.filter((id) => !alreadyOverridden.has(id));

  if (toApply.length > 0) {
    const rows = toApply.map((id) => ({ tenant_id: id, key: featureKey, enabled: included }));
    const { error } = await svc
      .from("tenant_feature_overrides")
      .upsert(rows, { onConflict: "tenant_id,key" });
    if (error) throw error;

    // Fire notifications only when adding (promoting) a feature
    if (included) {
      const { data: flag } = await svc
        .from("feature_flags")
        .select("label")
        .eq("key", featureKey)
        .maybeSingle();

      const label = (flag?.label as string) ?? featureKey;
      const notifs = toApply.map((id) => ({
        tenant_id: id,
        type: "plan_feature_added",
        title: `New feature: ${label}`,
        body: `${label} is now included in your plan. Explore it from your workspace.`,
        feature_key: featureKey,
      }));
      await svc.from("tenant_notifications").insert(notifs);
    }
  }

  revalidatePath("/admin/flags/plans");
  return { applied: toApply.length, skipped: alreadyOverridden.size };
}
