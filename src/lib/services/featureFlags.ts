import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";

/**
 * Staged-GTM feature flags. The bug tracker (Issues + Board) always ships; these
 * gate the project-management layer until the super-admin releases each one.
 *
 * Resolution: a per-tenant override wins; otherwise the global default. Reads go
 * through the service-role client (the tables are service-role only). Everything
 * FAILS OPEN — if the tables don't exist yet (migration 0032 unrun) or a read
 * errors, features are treated as enabled so the app never breaks.
 */

export const FEATURE_KEYS = ["think_tank", "dashboards", "project_portal"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type TenantFlags = Record<FeatureKey, boolean>;

const ALL_ON: TenantFlags = { think_tank: true, dashboards: true, project_portal: true };

/** Resolve every flag for a tenant in one read. Fails open. */
export async function loadTenantFlags(tenantId: string): Promise<TenantFlags> {
  try {
    const svc = createSupabaseServiceClient();
    const repo = featureFlagsRepo(svc);
    const [flags, overrides] = await Promise.all([repo.listFlags(), repo.listOverridesForTenant(tenantId)]);

    if (flags.length === 0) return { ...ALL_ON }; // pre-seed: don't hide anything

    const globalByKey = new Map(flags.map((f) => [f.key, f.enabled]));
    const overrideByKey = new Map(overrides.map((o) => [o.key, o.enabled]));

    const resolve = (key: FeatureKey): boolean => {
      if (overrideByKey.has(key)) return overrideByKey.get(key)!;
      if (globalByKey.has(key)) return globalByKey.get(key)!;
      return true; // unknown/absent flag → fail open
    };

    return {
      think_tank: resolve("think_tank"),
      dashboards: resolve("dashboards"),
      project_portal: resolve("project_portal"),
    };
  } catch {
    // Table missing (migration not yet run) or any read error → everything on.
    return { ...ALL_ON };
  }
}
