"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: issue hierarchy writes bypass RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueLinksRepo, type LinkType } from "@/lib/repositories/issueLinks";
import { createIssue } from "@/lib/services/issues";

function svc() {
  return issueLinksRepo(createSupabaseServiceClient());
}

export async function addIssueLinkAction(
  slug: string,
  sourceIssueId: string,
  targetIssueId: string,
  linkType: LinkType,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot add links.");
  if (sourceIssueId === targetIssueId) throw new Error("Cannot link an issue to itself.");
  await svc().create(ctx.tenant.id, sourceIssueId, targetIssueId, linkType);
  revalidatePath(`/${slug}/issues/${sourceIssueId}`);
}

export async function removeIssueLinkAction(slug: string, linkId: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot remove links.");
  await svc().delete(ctx.tenant.id, linkId);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function createSubIssueAction(
  slug: string,
  parentIssueId: string,
  projectId: string,
  title: string,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot create sub-issues.");
  if (!title.trim()) throw new Error("Title is required.");

  // Create the issue then set parent_id via service-role (parent_id not yet in createIssue input)
  const issue = await createIssue({
    tenantId: ctx.tenant.id,
    projectId,
    title: title.trim(),
    reporterId: ctx.appUserId,
  });

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("issues")
    .update({ parent_id: parentIssueId })
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", issue.id);
  if (error) throw error;

  revalidatePath(`/${slug}/issues/${parentIssueId}`);
}

export async function setParentIssueAction(
  slug: string,
  issueId: string,
  parentId: string | null,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot change parent.");
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("issues")
    .update({ parent_id: parentId })
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", issueId);
  if (error) throw error;
  revalidatePath(`/${slug}/issues/${issueId}`);
}
