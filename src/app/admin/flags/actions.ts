"use server";

import { revalidatePath } from "next/cache";
import { setGlobalFlag, setTenantOverride } from "@/lib/services/featureFlagsAdmin";

// Authorization is enforced inside each service call via requireSuperAdmin().

export async function setGlobalFlagAction(key: string, enabled: boolean) {
  await setGlobalFlag(key, enabled);
  revalidatePath("/admin/flags");
}

export async function setTenantOverrideAction(tenantId: string, key: string, enabled: boolean | null) {
  await setTenantOverride(tenantId, key, enabled);
  revalidatePath("/admin/flags");
}
