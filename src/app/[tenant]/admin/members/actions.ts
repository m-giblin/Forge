"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import {
  createInvite,
  revokeInvite,
  changeMemberRole,
  removeMember,
} from "@/lib/services/members";
import type { MembershipRole } from "@/lib/repositories/members";
import { recordAudit } from "@/lib/audit";
import { canDo } from "@/lib/permissions";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Owner/admin, or a custom role granted manage_members.
function assertAdmin(ctx: { role: string; customRolePermissions: import("@/lib/rbac").RbacPermissionSet | null }) {
  const role = ctx.role as "owner" | "admin" | "member" | "viewer";
  if (role !== "owner" && role !== "admin" && !ctxCanDo(ctx as Parameters<typeof ctxCanDo>[0], "manage_members")) {
    throw new Error("Only owners and admins manage members.");
  }
}

// Assigning a custom role is a privilege-escalation-sensitive action — kept
// strictly owner/admin regardless of any custom role, so a manage_members
// grant can't be used to hand out more powerful roles than the granter has.
function assertOwnerOrAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Only owners and admins can assign custom roles.");
}

export async function createInviteAction(
  slug: string,
  input: { role: MembershipRole; email: string | null; displayName?: string | null; jobTitles?: string[] }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  const memberCanInvite = ctx.role === "member" && canDo(ctx.role, "member.invite_members", ctx.permissionOverrides);
  if (!memberCanInvite) assertAdmin(ctx);
  const { token } = await createInvite({
    tenantId: ctx.tenant.id,
    role: input.role,
    email: input.email?.trim() || null,
    createdBy: ctx.appUserId,
    displayName: input.displayName?.trim() || null,
    jobTitles: input.jobTitles ?? [],
  });
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "invite.create",
    target: input.email?.trim() || `any (${input.role})`,
  });
  revalidatePath(`/${slug}/admin/members`);
  return { token }; // caller builds the link
}

export async function revokeInviteAction(slug: string, id: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
  await revokeInvite(ctx.tenant.id, id);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "invite.revoke", target: id });
  revalidatePath(`/${slug}/admin/members`);
}

export async function changeRoleAction(slug: string, membershipId: string, role: MembershipRole) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
  await changeMemberRole(ctx.tenant.id, membershipId, role);
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "member.role_change",
    target: membershipId,
    metadata: { role },
  });
  revalidatePath(`/${slug}/admin/members`);
}

export async function removeMemberAction(slug: string, membershipId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
  await removeMember(ctx.tenant.id, membershipId);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "member.remove", target: membershipId });
  revalidatePath(`/${slug}/admin/members`);
}

export async function setJobTitlesAction(slug: string, membershipId: string, titles: string[]) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("memberships")
    .update({ job_titles: titles })
    .eq("id", membershipId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/admin/members`);
}

export async function assignCustomRoleAction(slug: string, membershipId: string, customRoleId: string | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertOwnerOrAdmin(ctx.role);
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("memberships")
    .update({ custom_role_id: customRoleId })
    .eq("id", membershipId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/admin/members`);
}
