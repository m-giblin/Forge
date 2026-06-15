"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createIdea, updateIdea } from "@/lib/services/thinkTank";
import { ideasRepo, ideaCommentsRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/audit";

/** Returns the new idea's ID so the client can navigate to it. */
export async function createIdeaAction(
  slug: string,
  thinkTankId: string,
  formData: FormData
): Promise<string> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot create ideas.");

  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("Title is required.");

  const rawTags = (formData.get("tags") as string) ?? "";
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const idea = await createIdea(ctx.tenant.id, thinkTankId, ctx.appUserId, {
    title,
    description: (formData.get("description") as string)?.trim() || null,
    tags,
    is_private: formData.get("is_private") === "on",
    assigned_to: (formData.get("assigned_to") as string) || null,
  });

  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "idea.create",
    target: idea.id,
    metadata: { title: idea.title },
  });

  revalidatePath(`/${slug}/think-tank`);
  return idea.id;
}

export async function updateIdeaAction(
  slug: string,
  ideaId: string,
  formData: FormData
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const supabase = await createSupabaseServerClient();
  const idea = await ideasRepo(supabase).getById(ctx.tenant.id, ideaId);
  if (!idea) throw new Error("Idea not found.");

  const isCreator = idea.created_by === ctx.appUserId;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isCreator && !isAdmin) throw new Error("Only the creator or an admin can edit this idea.");

  const rawTags = (formData.get("tags") as string) ?? "";
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await updateIdea(ctx.tenant.id, ideaId, {
    title: (formData.get("title") as string)?.trim() || idea.title,
    description: (formData.get("description") as string)?.trim() || null,
    tags,
    is_private: formData.get("is_private") === "on",
    assigned_to: (formData.get("assigned_to") as string) || null,
  });

  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "idea.update",
    target: ideaId,
    metadata: {},
  });

  revalidatePath(`/${slug}/think-tank/${ideaId}`);
  revalidatePath(`/${slug}/think-tank`);
}

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export async function addIdeaCommentAction(
  slug: string,
  ideaId: string,
  body: string,
  parentId: string | null
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot comment.");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");
  if (trimmed.length > 10000) throw new Error("Comment is too long.");

  const supabase = await createSupabaseServerClient();
  await ideaCommentsRepo(supabase).add({
    tenantId: ctx.tenant.id,
    ideaId,
    authorId: ctx.appUserId,
    body: trimmed,
    parentId,
  });

  revalidatePath(`/${slug}/think-tank/${ideaId}`);
}

export async function editIdeaCommentAction(
  slug: string,
  commentId: string,
  body: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");

  const supabase = await createSupabaseServerClient();
  const repo = ideaCommentsRepo(supabase);
  const comment = await repo.getById(ctx.tenant.id, commentId);
  if (!comment) throw new Error("Comment not found.");
  if (comment.isDeleted) throw new Error("Cannot edit a deleted comment.");

  const isAuthor = comment.authorId === ctx.appUserId;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAuthor && !isAdmin) throw new Error("Not allowed.");

  if (isAuthor && !isAdmin) {
    const age = Date.now() - new Date(comment.createdAt).getTime();
    if (age > EDIT_WINDOW_MS) throw new Error("Comments can only be edited within 15 minutes of posting.");
  }

  await repo.edit(ctx.tenant.id, commentId, trimmed);
  revalidatePath(`/${slug}/think-tank/${comment.ideaId}`);
}

export async function deleteIdeaCommentAction(
  slug: string,
  commentId: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const supabase = await createSupabaseServerClient();
  const repo = ideaCommentsRepo(supabase);
  const comment = await repo.getById(ctx.tenant.id, commentId);
  if (!comment) throw new Error("Comment not found.");

  const isAuthor = comment.authorId === ctx.appUserId;
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAuthor && !isAdmin) throw new Error("Not allowed.");

  await repo.softDelete(ctx.tenant.id, commentId);
  revalidatePath(`/${slug}/think-tank/${comment.ideaId}`);
}

export async function advanceStatusAction(slug: string, ideaId: string, newStatus: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const TERMINAL = ["converted", "archived"];
  const FORWARD: Record<string, string[]> = {
    new:         ["researching", "archived"],
    researching: ["maturing", "archived"],
    maturing:    ["ready", "archived"],
    ready:       ["converted", "archived"],
  };

  const supabase = await createSupabaseServerClient();
  const idea = await ideasRepo(supabase).getById(ctx.tenant.id, ideaId);
  if (!idea) throw new Error("Idea not found.");
  if (TERMINAL.includes(idea.status)) throw new Error("This idea has reached a terminal status.");

  const allowed = FORWARD[idea.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from "${idea.status}" to "${newStatus}".`);
  }

  const patch: Parameters<typeof updateIdea>[2] = { status: newStatus };
  if (newStatus === "converted") patch.converted_at = new Date().toISOString();

  await updateIdea(ctx.tenant.id, ideaId, patch);

  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "idea.status_change",
    target: ideaId,
    metadata: { from: idea.status, to: newStatus },
  });

  revalidatePath(`/${slug}/think-tank/${ideaId}`);
  revalidatePath(`/${slug}/think-tank`);
}
