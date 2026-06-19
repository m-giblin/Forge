import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireSuperAdmin } from "@/lib/super-admin";
import { featureFlagsRepo, type FeatureFlag, type TenantOverride } from "@/lib/repositories/featureFlags";

// All super-admin only. Powers the platform Feature Flags console.

export async function listGlobalFlags(): Promise<FeatureFlag[]> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  return featureFlagsRepo(createSupabaseServiceClient()).listFlags();
}

export async function listAllOverrides(): Promise<TenantOverride[]> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  return featureFlagsRepo(createSupabaseServiceClient()).listOverrides();
}

export async function setGlobalFlag(key: string, enabled: boolean): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  await featureFlagsRepo(createSupabaseServiceClient()).setGlobal(key, enabled);
}

export async function setTenantOverride(tenantId: string, key: string, enabled: boolean | null): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  await featureFlagsRepo(createSupabaseServiceClient()).setOverride(tenantId, key, enabled);
}
