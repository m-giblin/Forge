"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: roadmap_phases writes bypass user RLS (phase mgmt is admin-only; gate enforced in code)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function requireAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only owners and admins can manage roadmap phases.");
  }
}

export async function createPhaseAction(
  slug: string,
  data: { name: string; color: string; start_date: string | null; end_date: string | null }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const svc = createSupabaseServiceClient();
  const { count } = await svc
    .from("roadmap_phases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant.id);

  const { error } = await svc.from("roadmap_phases").insert({
    tenant_id: ctx.tenant.id,
    name: data.name.trim(),
    color: data.color,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    position: (count ?? 0) + 1,
  });
  if (error) throw error;
  revalidatePath(`/${slug}/roadmap`);
}

export async function updatePhaseAction(
  slug: string,
  phaseId: string,
  data: { name?: string; color?: string; start_date?: string | null; end_date?: string | null }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.color !== undefined) patch.color = data.color;
  if (data.start_date !== undefined) patch.start_date = data.start_date || null;
  if (data.end_date !== undefined) patch.end_date = data.end_date || null;

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("roadmap_phases")
    .update(patch)
    .eq("id", phaseId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/roadmap`);
}

export async function deletePhaseAction(slug: string, phaseId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const svc = createSupabaseServiceClient();
  // Unlink projects first
  await svc
    .from("projects")
    .update({ phase_id: null })
    .eq("tenant_id", ctx.tenant.id)
    .eq("phase_id", phaseId);

  const { error } = await svc
    .from("roadmap_phases")
    .delete()
    .eq("id", phaseId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/roadmap`);
}

export async function assignProjectPhaseAction(slug: string, projectId: string, phaseId: string | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("projects")
    .update({ phase_id: phaseId })
    .eq("id", projectId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/roadmap`);
}
