"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { projectsRepo, projectWikiPagesRepo } from "@/lib/repositories/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
