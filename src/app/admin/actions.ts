"use server";

import { revalidatePath } from "next/cache";
import { provisionTenant, setTenantSuspended, deleteTenant } from "@/lib/services/platform";
import { requireSuperAdmin } from "@/lib/super-admin";
import { setSetting } from "@/lib/platformSettings";

// Authorization is enforced inside each service call via requireSuperAdmin().

/** Save the two graduated SDK-suspension thresholds (see sdkFallbackAlerts.ts). */
export async function saveSdkSuspensionWindowsAction(notifyDays: number, graceDays: number): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const clampedNotify = Math.max(1, Math.min(365, Math.round(notifyDays)));
  const clampedGrace = Math.max(clampedNotify, Math.min(365, Math.round(graceDays)));
  await setSetting("sdk_suspension_notify_days", String(clampedNotify));
  await setSetting("sdk_suspension_grace_days", String(clampedGrace));
  revalidatePath("/admin/tenants");
}

export async function provisionTenantAction(input: { name: string; slug: string; ownerEmail: string }) {
  const result = await provisionTenant(input);
  revalidatePath("/admin");
  return result; // { slug, ownerInviteToken }
}

export async function setSuspendedAction(id: string, suspended: boolean) {
  await setTenantSuspended(id, suspended);
  revalidatePath("/admin");
}

export async function deleteTenantAction(id: string) {
  await deleteTenant(id);
  revalidatePath("/admin");
}
