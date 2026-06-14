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

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Only owners and admins manage members.");
}

export async function createInviteAction(slug: string, input: { role: MembershipRole; email: string | null }) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
  const { token } = await createInvite({
    tenantId: ctx.tenant.id,
    role: input.role,
    email: input.email?.trim() || null,
    createdBy: ctx.appUserId,
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
  assertAdmin(ctx.role);
  await revokeInvite(ctx.tenant.id, id);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "invite.revoke", target: id });
  revalidatePath(`/${slug}/admin/members`);
}

export async function changeRoleAction(slug: string, membershipId: string, role: MembershipRole) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
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
  assertAdmin(ctx.role);
  await removeMember(ctx.tenant.id, membershipId);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "member.remove", target: membershipId });
  revalidatePath(`/${slug}/admin/members`);
}
