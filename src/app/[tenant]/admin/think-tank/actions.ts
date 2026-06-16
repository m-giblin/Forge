"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { thinkTankPillsRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requireAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Admin access required.");
}

export async function createPillAction(slug: string, formData: FormData): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const label = (formData.get("label") as string)?.trim();
  const instruction = (formData.get("instruction") as string)?.trim();
  if (!label) throw new Error("Label is required.");
  if (!instruction) throw new Error("Instruction is required.");

  const supabase = await createSupabaseServerClient();
  await thinkTankPillsRepo(supabase).create({ tenantId: ctx.tenant.id, label, instruction });
  revalidatePath(`/${slug}/admin/think-tank`);
}

export async function updatePillAction(slug: string, pillId: string, formData: FormData): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const label = (formData.get("label") as string)?.trim();
  const instruction = (formData.get("instruction") as string)?.trim();
  if (!label) throw new Error("Label is required.");
  if (!instruction) throw new Error("Instruction is required.");

  const supabase = await createSupabaseServerClient();
  await thinkTankPillsRepo(supabase).update(ctx.tenant.id, pillId, { label, instruction });
  revalidatePath(`/${slug}/admin/think-tank`);
}

export async function deletePillAction(slug: string, pillId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const supabase = await createSupabaseServerClient();
  await thinkTankPillsRepo(supabase).delete(ctx.tenant.id, pillId);
  revalidatePath(`/${slug}/admin/think-tank`);
}
