"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createIssue, moveIssue, updateIssue, COLUMN_PAGE_SIZE } from "@/lib/services/issues";
import type { Issue, IssuePriority, IssueStatus, IssueType } from "@/lib/repositories/issues";
import { ctxCanDo } from "@/lib/rbac";
import { canDo } from "@/lib/permissions";
// eslint-disable-next-line no-restricted-imports -- service-role required for child-count and load-more reads
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Every action re-checks tenant membership server-side. The client cannot be
// trusted; authorization lives here + RLS, never in the UI.

export async function createIssueAction(
  slug: string,
  input: {
    projectId: string;
    title: string;
    description?: string;
    priority?: IssuePriority;
    type?: IssueType;
    categoryId?: string | null;
    customValues?: Record<string, unknown>;
    sprintId?: string | null;
    assigneeId?: string | null;
    status?: string;
    startDate?: string | null;
    dueDate?: string | null;
    storyPoints?: number | null;
    parentId?: string | null;
  }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  // ctxCanDo: owners/admins always pass; members pass unless a custom role restricts them;
  // viewers are blocked by default. canDo then re-allows viewers when the tenant has
  // explicitly granted viewer.create_issue in their permission overrides.
  const viewerGranted = ctx.role === "viewer" && canDo(ctx.role, "viewer.create_issue", ctx.permissionOverrides);
  if (!viewerGranted && !ctxCanDo(ctx, "create_issues"))
    throw new Error("You don't have permission to create issues in this workspace");

  // Validate projectId belongs to this tenant — prevents cross-tenant project injection
  const svcForCheck = createSupabaseServiceClient();
  const { data: proj } = await svcForCheck.from("projects").select("id").eq("id", input.projectId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!proj) throw new Error("Project not found");

  // Parent must be an issue in this same tenant and project — checked before
  // anything is created so a bad parent never leaves a half-made issue.
  if (input.parentId) {
    const { data: parent } = await svcForCheck.from("issues").select("id").eq("id", input.parentId).eq("tenant_id", ctx.tenant.id).eq("project_id", input.projectId).maybeSingle();
    if (!parent) throw new Error("Parent issue not found in this project");
  }

  const issue = await createIssue({
    tenantId: ctx.tenant.id,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    type: input.type,
    categoryId: input.categoryId,
    customValues: input.customValues,
    reporterId: ctx.appUserId,
    sprintId: input.sprintId,
    assigneeId: input.assigneeId,
    status: input.status,
  });

  // The rest of the "More details" fields go through the same validated
  // update path the issue page uses, so the rules live in one place.
  const extras: Parameters<typeof updateIssue>[2] = {};
  if (input.startDate) extras.startDate = input.startDate;
  if (input.dueDate) extras.dueDate = input.dueDate;
  if (input.storyPoints != null && Number.isFinite(input.storyPoints)) extras.storyPoints = input.storyPoints;
  let result = Object.keys(extras).length ? await updateIssue(ctx.tenant.id, issue.id, extras, { userId: ctx.appUserId, label: ctx.email }) : issue;

  if (input.parentId) {
    const { error } = await svcForCheck.from("issues").update({ parent_id: input.parentId }).eq("id", issue.id).eq("tenant_id", ctx.tenant.id);
    if (error) throw new Error("Issue created, but the parent couldn't be set");
    result = { ...result, parent_id: input.parentId };
  }
  revalidatePath(`/${slug}/board`);
  return result;
}

export async function moveIssueAction(
  slug: string,
  id: string,
  status: IssueStatus,
): Promise<{ pendingChildCount: number }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot move issues");

  await moveIssue(ctx.tenant.id, id, status);
  revalidatePath(`/${slug}/board`);

  // Count children not yet on the new status so the board can prompt a cascade.
  const svc = createSupabaseServiceClient();
  const { count } = await svc
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant.id)
    .eq("parent_id", id)
    .neq("status", status);
  return { pendingChildCount: count ?? 0 };
}

/**
 * Cursor-based (not offset-based) on purpose: the board supports drag-and-drop
 * reordering, which rewrites `position` for the moved card and its neighbors.
 * An offset/range query re-run after that shift can skip or repeat rows;
 * "fetch everything after this exact position value" can't.
 */
export async function loadMoreForStatusAction(
  slug: string,
  projectId: string,
  status: string,
  afterPosition: number | null,
): Promise<{ issues: Issue[]; hasMore: boolean; cursor: number | null }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const svc = createSupabaseServiceClient();

  // Validate projectId belongs to this tenant before using it in the query
  const { data: proj } = await svc.from("projects").select("id").eq("id", projectId).eq("tenant_id", ctx.tenant.id).maybeSingle();
  if (!proj) throw new Error("Project not found");

  let q = svc
    .from("issues")
    .select("*")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .eq("status", status)
    .order("position", { ascending: true })
    .limit(COLUMN_PAGE_SIZE + 1);
  if (afterPosition !== null) q = q.gt("position", afterPosition);
  const { data } = await q;

  const rows = (data ?? []) as Issue[];
  const hasMore = rows.length > COLUMN_PAGE_SIZE;
  const issues = hasMore ? rows.slice(0, COLUMN_PAGE_SIZE) : rows;
  const cursor = issues.length > 0 ? issues[issues.length - 1].position : afterPosition;
  return { issues, hasMore, cursor };
}

export async function quickEditIssueAction(
  slug: string,
  id: string,
  patch: { priority?: IssuePriority; assigneeId?: string | null; title?: string }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues");

  const { updateIssue } = await import("@/lib/services/issues");
  await updateIssue(ctx.tenant.id, id, patch, { userId: ctx.appUserId, label: null });
  revalidatePath(`/${slug}/board`);
}
