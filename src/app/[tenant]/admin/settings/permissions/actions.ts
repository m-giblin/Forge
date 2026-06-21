"use server";

import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: admin-only write
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { PermissionOverrides } from "@/lib/permissions";

export async function savePermissionOverridesAction(
  slug: string,
  overrides: PermissionOverrides
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx || !["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");

  const { error } = await createSupabaseServiceClient()
    .from("tenants")
    .update({ permission_overrides: overrides })
    .eq("id", ctx.tenant.id);
  if (error) throw error;
}
