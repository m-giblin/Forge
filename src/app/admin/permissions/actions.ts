"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { permissionDefinitionsRepo, type PermissionDefinition } from "@/lib/repositories/permissionDefinitions";

export async function createPermissionAction(input: Omit<PermissionDefinition, "isActive">): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!key) throw new Error("Permission key is required.");
  await permissionDefinitionsRepo(createSupabaseServiceClient()).create({ ...input, key });
  revalidatePath("/admin/permissions");
}

export async function updatePermissionAction(key: string, patch: Partial<Omit<PermissionDefinition, "key">>): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  await permissionDefinitionsRepo(createSupabaseServiceClient()).update(key, patch);
  revalidatePath("/admin/permissions");
}
