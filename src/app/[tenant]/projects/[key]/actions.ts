"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { projectsRepo, projectWikiPagesRepo, projectSpendRepo, type ProjectStatus } from "@/lib/repositories/projects";
import { changeProjectStatus, deleteProject, updateProject } from "@/lib/services/projects";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canDo } from "@/lib/permissions";
import { ctxCanDo, type RbacPermissionSet } from "@/lib/rbac";

function assertCanManageProjects(ctx: { role: string; permissionOverrides: Record<string, boolean>; customRolePermissions: RbacPermissionSet | null }) {
  const role = ctx.role as "owner" | "admin" | "member" | "viewer";
  const memberGranted = role === "member" && canDo(role, "member.manage_projects", ctx.permissionOverrides);
  const rbacGranted = ctxCanDo(ctx as Parameters<typeof ctxCanDo>[0], "manage_projects");
  if (!memberGranted && !rbacGranted && role !== "owner" && role !== "admin")
    throw new Error("Only owners and admins can manage projects.");
}

export async function updateProjectAction(
  slug: string,
  projectKey: string,
  patch: { name?: string; description?: string | null },
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanManageProjects(ctx);
  await updateProject(ctx.tenant.id, projectKey, patch, ctx.role, ctx.impersonating);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "project.update", target: projectKey });
  revalidatePath(`/${slug}/projects/${projectKey}`);
  revalidatePath(`/${slug}/projects`);
}

export async function changeStatusAction(slug: string, projectKey: string, status: ProjectStatus): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanManageProjects(ctx);
  await changeProjectStatus(ctx.tenant.id, projectKey, status, ctx.role, ctx.impersonating);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "project.status", target: `${projectKey} → ${status}` });
  revalidatePath(`/${slug}/projects/${projectKey}`);
  revalidatePath(`/${slug}/projects`);
}

export async function deleteProjectAction(slug: string, projectKey: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanManageProjects(ctx);
  await deleteProject(ctx.tenant.id, projectKey, ctx.role);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "project.delete", target: projectKey });
  revalidatePath(`/${slug}/projects`);
  redirect(`/${slug}/projects`);
}

export async function updateWikiAction(
  slug: string,
  projectKey: string,
  body: string,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit the wiki.");

  const supabase = await createSupabaseServerClient();
  const project = await projectsRepo(supabase).getByKey(ctx.tenant.id, projectKey);
  if (!project) throw new Error("Project not found.");

  await projectWikiPagesRepo(supabase).update(ctx.tenant.id, project.id, ctx.appUserId, body);
  revalidatePath(`/${slug}/projects/${projectKey}`);
}

// ---- Costs (budget + spend). Contributing members only (not viewers). ----

async function projectForEdit(slug: string, projectKey: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit costs.");
  const supabase = await createSupabaseServerClient();
  const project = await projectsRepo(supabase).getByKey(ctx.tenant.id, projectKey);
  if (!project) throw new Error("Project not found.");
  return { ctx, supabase, project };
}

/** Set (or clear) the project budget. Dollars in → integer cents stored. */
export async function setBudgetAction(slug: string, projectKey: string, budgetDollars: number | null): Promise<void> {
  const { ctx, supabase, project } = await projectForEdit(slug, projectKey);
  const cents = budgetDollars == null || Number.isNaN(budgetDollars) ? null : Math.round(budgetDollars * 100);
  if (cents != null && cents < 0) throw new Error("Budget can't be negative.");
  await projectsRepo(supabase).setBudget(ctx.tenant.id, project.id, cents);
  revalidatePath(`/${slug}/projects/${projectKey}`);
}

export async function addSpendAction(
  slug: string,
  projectKey: string,
  input: { item: string; category: string; amountDollars: number; spentOn: string },
): Promise<void> {
  const { ctx, supabase, project } = await projectForEdit(slug, projectKey);
  const item = input.item.trim();
  if (!item) throw new Error("Spend needs a description.");
  if (!Number.isFinite(input.amountDollars) || input.amountDollars <= 0) throw new Error("Amount must be greater than zero.");
  await projectSpendRepo(supabase).add({
    tenantId: ctx.tenant.id,
    projectId: project.id,
    item,
    category: input.category.trim() || null,
    amountCents: Math.round(input.amountDollars * 100),
    spentOn: input.spentOn || null,
    createdBy: ctx.appUserId,
  });
  revalidatePath(`/${slug}/projects/${projectKey}`);
}

export async function removeSpendAction(slug: string, projectKey: string, spendId: string): Promise<void> {
  const { ctx, supabase } = await projectForEdit(slug, projectKey);
  await projectSpendRepo(supabase).remove(ctx.tenant.id, spendId);
  revalidatePath(`/${slug}/projects/${projectKey}`);
}
