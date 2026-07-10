"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { canDo } from "@/lib/permissions";
// eslint-disable-next-line no-restricted-imports -- service-role: mind-map writes bypass user-JWT RLS, matching sprintActions.ts (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { epicsRepo, type Epic } from "@/lib/repositories/epics";
import { sprintsRepo, type Sprint } from "@/lib/repositories/sprints";
import { createIssue } from "@/lib/services/issues";
import type { Issue } from "@/lib/repositories/issues";
import { recordAudit } from "@/lib/audit";

function assertCanManageProjects(ctx: Parameters<typeof ctxCanDo>[0] & { permissionOverrides: Record<string, boolean> }) {
  const role = ctx.role as "owner" | "admin" | "member" | "viewer";
  const memberGranted = role === "member" && canDo(role, "member.manage_projects", ctx.permissionOverrides);
  if (!memberGranted && !ctxCanDo(ctx, "manage_projects") && role !== "owner" && role !== "admin")
    throw new Error("You don't have permission to manage this project's structure.");
}

function assertCanManageSprints(ctx: Parameters<typeof ctxCanDo>[0]) {
  if (!ctxCanDo(ctx, "manage_sprints")) throw new Error("You don't have permission to manage sprints.");
}

function assertCanCreateIssues(ctx: Parameters<typeof ctxCanDo>[0] & { role: string; permissionOverrides: Record<string, boolean> }) {
  const viewerGranted = ctx.role === "viewer" && canDo(ctx.role as "viewer", "viewer.create_issue", ctx.permissionOverrides);
  if (!viewerGranted && !ctxCanDo(ctx, "create_issues")) throw new Error("You don't have permission to create issues here.");
}

/** Confirms projectId actually belongs to this tenant before any write touches it. */
async function assertProjectInTenant(tenantId: string, projectId: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc.from("projects").select("id").eq("id", projectId).eq("tenant_id", tenantId).maybeSingle();
  if (!data) throw new Error("Project not found in this workspace.");
}

export async function createEpicFromMindMapAction(
  slug: string,
  projectKey: string,
  projectId: string,
  title: string
): Promise<Epic> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanManageProjects(ctx);
  await assertProjectInTenant(ctx.tenant.id, projectId);

  const epic = await epicsRepo(createSupabaseServiceClient()).create({
    tenantId: ctx.tenant.id,
    projectId,
    title: title.trim() || "New epic",
    createdBy: ctx.appUserId,
  });
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "epic.create", target: epic.title });
  revalidatePath(`/${slug}/projects/${projectKey}/mindmap`);
  return epic;
}

export async function createSprintFromMindMapAction(
  slug: string,
  projectKey: string,
  projectId: string,
  epicId: string | null,
  name: string
): Promise<Sprint> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanManageSprints(ctx);
  await assertProjectInTenant(ctx.tenant.id, projectId);

  const sprint = await sprintsRepo(createSupabaseServiceClient()).create({
    tenantId: ctx.tenant.id,
    projectId,
    name: name.trim() || "New sprint",
    epicId,
  });
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "sprint.create", target: sprint.name });
  revalidatePath(`/${slug}/projects/${projectKey}/mindmap`);
  revalidatePath(`/${slug}/board`);
  return sprint;
}

export async function createIssueFromMindMapAction(
  slug: string,
  projectKey: string,
  projectId: string,
  sprintId: string | null,
  title: string
): Promise<Issue> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanCreateIssues(ctx);
  await assertProjectInTenant(ctx.tenant.id, projectId);

  const issue = await createIssue({
    tenantId: ctx.tenant.id,
    projectId,
    title: title.trim() || "New issue",
    sprintId,
    reporterId: ctx.appUserId,
  });
  revalidatePath(`/${slug}/projects/${projectKey}/mindmap`);
  revalidatePath(`/${slug}/board`);
  return issue;
}

/** Bulk re-parent: moves every selected issue into one sprint in a single action. */
export async function bulkMoveIssuesToSprintAction(
  slug: string,
  projectKey: string,
  projectId: string,
  issueIds: string[],
  sprintId: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanManageSprints(ctx);
  await assertProjectInTenant(ctx.tenant.id, projectId);

  const repo = sprintsRepo(createSupabaseServiceClient());
  await Promise.all(issueIds.map((issueId) => repo.addIssue(sprintId, ctx.tenant.id, issueId)));

  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "issue.bulk_move_sprint",
    target: `${issueIds.length} issue(s) → sprint ${sprintId}`,
  });
  revalidatePath(`/${slug}/projects/${projectKey}/mindmap`);
  revalidatePath(`/${slug}/board`);
}
