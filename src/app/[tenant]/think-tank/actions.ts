"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createIdea, updateIdea } from "@/lib/services/thinkTank";
import { ideasRepo } from "@/lib/repositories/ideas";
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
