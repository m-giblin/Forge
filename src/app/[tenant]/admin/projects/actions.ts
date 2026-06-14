"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { addProjectMember, removeProjectMember } from "@/lib/services/projects";
import { recordAudit } from "@/lib/audit";

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Only owners and admins manage project teams.");
}

export async function addProjectMemberAction(slug: string, projectId: string, userId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
  await addProjectMember(ctx.tenant.id, projectId, userId);
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.member_add",
    target: projectId,
    metadata: { userId },
  });
  revalidatePath(`/${slug}/admin/projects`);
}

export async function removeProjectMemberAction(slug: string, projectId: string, userId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
  await removeProjectMember(ctx.tenant.id, projectId, userId);
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.member_remove",
    target: projectId,
    metadata: { userId },
  });
  revalidatePath(`/${slug}/admin/projects`);
}
