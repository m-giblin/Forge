"use server";

// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getTenantContext } from "@/lib/auth";
import { customRolesRepo } from "@/lib/repositories/customRoles";
import type { RbacPermissionSet } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

async function requireAdmin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Forbidden");
  return ctx;
}

export async function createRoleAction(
  slug: string,
  input: { name: string; description?: string; color?: string; permissions: RbacPermissionSet }
) {
  const ctx = await requireAdmin(slug);
  const svc = createSupabaseServiceClient();
  await customRolesRepo(svc).create(ctx.tenant.id, input);
  revalidatePath(`/${slug}/admin/roles`);
  revalidatePath(`/${slug}/admin/members`);
}

export async function updateRoleAction(
  slug: string,
  roleId: string,
  patch: { name?: string; description?: string | null; color?: string; permissions?: RbacPermissionSet }
) {
  const ctx = await requireAdmin(slug);
  const svc = createSupabaseServiceClient();
  await customRolesRepo(svc).update(roleId, ctx.tenant.id, patch);
  revalidatePath(`/${slug}/admin/roles`);
  revalidatePath(`/${slug}/admin/members`);
}

export async function deleteRoleAction(slug: string, roleId: string) {
  const ctx = await requireAdmin(slug);
  const svc = createSupabaseServiceClient();
  const repo = customRolesRepo(svc);
  const roles = await repo.list(ctx.tenant.id);
  const role = roles.find((r) => r.id === roleId);
  if (role?.memberCount && role.memberCount > 0) {
    throw new Error(`Cannot delete "${role.name}" — ${role.memberCount} member(s) still assigned. Reassign them first.`);
  }
  await repo.delete(roleId, ctx.tenant.id);
  revalidatePath(`/${slug}/admin/roles`);
  revalidatePath(`/${slug}/admin/members`);
}

export async function assignCustomRoleAction(
  slug: string,
  membershipId: string,
  customRoleId: string | null
) {
  const ctx = await requireAdmin(slug);
  const svc = createSupabaseServiceClient();
  await customRolesRepo(svc).assignToMembership(membershipId, ctx.tenant.id, customRoleId);
  revalidatePath(`/${slug}/admin/members`);
}
