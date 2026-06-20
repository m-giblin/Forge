"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: admin SLA writes need to bypass RLS gap on insert (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { slaPoliciesRepo, type SlaTier } from "@/lib/repositories/slaPolicies";

async function adminCtx(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");
  return ctx;
}

export async function createSlaPolicyAction(
  slug: string,
  name: string,
  conditions: { priority?: string[] },
  tiers: SlaTier[]
): Promise<void> {
  const ctx = await adminCtx(slug);
  const repo = slaPoliciesRepo(createSupabaseServiceClient());
  await repo.create(ctx.tenant.id, { name, conditions, tiers });
  revalidatePath(`/${slug}/admin/settings/sla`);
}

export async function updateSlaPolicyAction(
  slug: string,
  id: string,
  patch: { name?: string; conditions?: { priority?: string[] }; tiers?: SlaTier[]; enabled?: boolean }
): Promise<void> {
  const ctx = await adminCtx(slug);
  const repo = slaPoliciesRepo(createSupabaseServiceClient());
  await repo.update(ctx.tenant.id, id, patch);
  revalidatePath(`/${slug}/admin/settings/sla`);
}

export async function deleteSlaPolicyAction(slug: string, id: string): Promise<void> {
  const ctx = await adminCtx(slug);
  const repo = slaPoliciesRepo(createSupabaseServiceClient());
  await repo.delete(ctx.tenant.id, id);
  revalidatePath(`/${slug}/admin/settings/sla`);
}
