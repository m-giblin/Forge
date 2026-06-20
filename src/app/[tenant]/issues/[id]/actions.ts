"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { updateIssue, deleteIssue, addIssueComment, type IssuePatch } from "@/lib/services/issues";

export async function updateIssueAction(slug: string, id: string, patch: IssuePatch) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues.");
  const issue = await updateIssue(ctx.tenant.id, id, patch, { userId: ctx.appUserId, label: ctx.email });
  revalidatePath(`/${slug}/issues/${id}`);
  revalidatePath(`/${slug}/board`);
  return issue;
}

export async function addCommentAction(slug: string, id: string, body: string, parentId?: string | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot comment.");
  const comment = await addIssueComment({
    tenantId: ctx.tenant.id,
    issueId: id,
    authorId: ctx.appUserId,
    authorLabel: ctx.email,
    body,
    parentId: parentId ?? null,
  });
  revalidatePath(`/${slug}/issues/${id}`);
  return comment;
}

export async function deleteIssueAction(slug: string, id: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("Only owners and admins can delete issues.");
  }
  await deleteIssue(ctx.tenant.id, id);
  revalidatePath(`/${slug}/board`);
  redirect(`/${slug}/board`);
}
