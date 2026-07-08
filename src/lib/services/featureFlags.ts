import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";

// Resolution precedence (highest wins):
//   1. Kill switch (platform_settings) — handled at call site, not here
//   2. tenant_feature_overrides — super-admin per-tenant hard on/off
//   3. plan_tier_features[tenant.subscription_tier][key] — plan default, only while
//      subscription_status is trialing/active; a lapsed subscription drops to 'basic'
//   4. tenant_self_overrides — tenant admin can only disable (never enable beyond plan)
//   5. Fail open if tables missing

export const FEATURE_KEYS = [
  "think_tank", "dashboards", "project_portal",
  "ops_layer", "ops_layer_premium",
  "ai_sprint", "advanced_reports",
  "job_titles", "pdf_exports",
  "rbac", "roadmap", "sso",
  "advanced_ai", "webhooks",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type TenantFlags = Record<FeatureKey, boolean>;

const ALL_ON: TenantFlags = {
  think_tank: true, dashboards: true, project_portal: true,
  ops_layer: true, ops_layer_premium: true,
  ai_sprint: true, advanced_reports: true,
  job_titles: true, pdf_exports: true,
  rbac: true, roadmap: true, sso: true,
  advanced_ai: true, webhooks: true,
};

/** Resolve every flag for a tenant. Fails open on any read error. */
export async function loadTenantFlags(tenantId: string): Promise<TenantFlags> {
  try {
    const svc = createSupabaseServiceClient();
    const repo = featureFlagsRepo(svc);

    const [flags, superOverrides, tenantRow, selfOverrides] = await Promise.all([
      repo.listFlags(),
      repo.listOverridesForTenant(tenantId),
      svc.from("tenants").select("subscription_tier, subscription_status").eq("id", tenantId).maybeSingle(),
      svc.from("tenant_self_overrides")
        .select("feature_key, enabled")
        .eq("tenant_id", tenantId),
    ]);

    if (flags.length === 0) return { ...ALL_ON };

    const status = (tenantRow.data?.subscription_status as string | null) ?? "free";
    // A lapsed or cancelled subscription loses paid-tier entitlements immediately —
    // billing status gates the tier, not just the tier name stored on the row.
    const billingActive = status === "trialing" || status === "active";
    const plan = billingActive ? ((tenantRow.data?.subscription_tier as string | null) ?? "basic") : "basic";

    // Fetch plan tier features for this tenant's plan
    const { data: planFeatures } = await svc
      .from("plan_tier_features")
      .select("feature_key, included")
      .eq("plan_key", plan);

    const globalByKey = new Map(flags.map((f) => [f.key, f.enabled]));
    const superByKey  = new Map(superOverrides.map((o) => [o.key, o.enabled]));
    const planByKey   = new Map((planFeatures ?? []).map((p) => [p.feature_key as string, p.included as boolean]));
    const selfByKey   = new Map((selfOverrides.data ?? []).map((s) => [s.feature_key as string, s.enabled as boolean]));

    const resolve = (key: FeatureKey): boolean => {
      // Super-admin override wins outright
      if (superByKey.has(key)) return superByKey.get(key)!;
      // Plan tier default (falls back to global flag if plan row missing)
      const planVal = planByKey.has(key) ? planByKey.get(key)! : (globalByKey.get(key) ?? true);
      // Tenant self-override can only disable (enabled=false); never elevate
      if (selfByKey.has(key) && selfByKey.get(key) === false) return false;
      return planVal;
    };

    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, resolve(k)])) as TenantFlags;
  } catch {
    return { ...ALL_ON };
  }
}
