"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";

export async function setGlobalFlagAction(key: string, enabled: boolean) {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  await featureFlagsRepo(createSupabaseServiceClient()).setGlobal(key, enabled);
  revalidatePath("/admin/flags");
}

export async function setTenantOverrideAction(tenantId: string, key: string, enabled: boolean | null) {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  await featureFlagsRepo(createSupabaseServiceClient()).setOverride(tenantId, key, enabled);
  revalidatePath("/admin/flags");
}

export async function setPlatformSettingAction(key: string, value: string): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  revalidatePath("/admin/flags");
}
