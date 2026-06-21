"use server";

import { revalidatePath } from "next/cache";
import { setGlobalFlag, setTenantOverride } from "@/lib/services/featureFlagsAdmin";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Authorization is enforced inside each service call via requireSuperAdmin().

export async function setGlobalFlagAction(key: string, enabled: boolean) {
  await setGlobalFlag(key, enabled);
  revalidatePath("/admin/flags");
}

export async function setTenantOverrideAction(tenantId: string, key: string, enabled: boolean | null) {
  await setTenantOverride(tenantId, key, enabled);
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
