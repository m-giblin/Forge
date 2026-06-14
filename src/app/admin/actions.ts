"use server";

import { revalidatePath } from "next/cache";
import { provisionTenant, setTenantSuspended, deleteTenant } from "@/lib/services/platform";

// Authorization is enforced inside each service call via requireSuperAdmin().

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
