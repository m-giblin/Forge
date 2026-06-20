"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { savedViewsRepo, type ViewFilters } from "@/lib/repositories/savedViews";

export async function listSavedViewsAction(slug: string, projectId?: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  const supabase = await createSupabaseServerClient();
  return savedViewsRepo(supabase).list(ctx.tenant.id, projectId);
}

export async function createSavedViewAction(
  slug: string,
  name: string,
  filters: ViewFilters,
  projectId: string | null,
  isShared: boolean
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot save views.");
  const supabase = await createSupabaseServerClient();
  const view = await savedViewsRepo(supabase).create({
    tenantId: ctx.tenant.id,
    projectId,
    userId: ctx.appUserId,
    name,
    filters,
    isShared,
  });
  revalidatePath(`/${slug}/issues`);
  return view;
}

export async function deleteSavedViewAction(slug: string, viewId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  const supabase = await createSupabaseServerClient();
  await savedViewsRepo(supabase).delete(ctx.tenant.id, viewId);
  revalidatePath(`/${slug}/issues`);
}
