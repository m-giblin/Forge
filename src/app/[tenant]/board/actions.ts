"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createIssue, moveIssue } from "@/lib/services/issues";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/repositories/issues";
import { canDo } from "@/lib/permissions";

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
  }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!canDo(ctx.role, "viewer.create_issue", ctx.permissionOverrides) && ctx.role === "viewer")
    throw new Error("Viewers cannot create issues in this workspace");

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
  });
  revalidatePath(`/${slug}/board`);
  return issue;
}

export async function moveIssueAction(slug: string, id: string, status: IssueStatus) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot move issues");

  await moveIssue(ctx.tenant.id, id, status);
  revalidatePath(`/${slug}/board`);
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
