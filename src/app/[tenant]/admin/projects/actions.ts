"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { addProjectMember, removeProjectMember } from "@/lib/services/projects";
import { recordAudit } from "@/lib/audit";
import { projectsRepo } from "@/lib/repositories/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ctxCanDo } from "@/lib/rbac";

function assertAdmin(ctx: { role: string; customRolePermissions: import("@/lib/rbac").RbacPermissionSet | null }) {
  const role = ctx.role as "owner" | "admin" | "member" | "viewer";
  if (role !== "owner" && role !== "admin" && !ctxCanDo(ctx as Parameters<typeof ctxCanDo>[0], "manage_projects")) {
    throw new Error("Only owners and admins manage project teams.");
  }
}

export async function addProjectMemberAction(slug: string, projectId: string, userId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx);
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
  assertAdmin(ctx);
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

export async function deleteProjectAction(slug: string, projectId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can delete projects.");
  const supabase = await createSupabaseServerClient();
  await projectsRepo(supabase).deleteById(ctx.tenant.id, projectId);
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "project.delete",
    target: projectId,
    metadata: {},
  });
  revalidatePath(`/${slug}/admin/projects`);
  redirect(`/${slug}/admin/projects`);
}
