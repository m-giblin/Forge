"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { customersRepo } from "@/lib/repositories/customers";
import { revalidatePath } from "next/cache";

async function requireAdmin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admin required");
  const supabase = await createSupabaseServerClient();
  return { ctx, supabase };
}

export async function createCustomerAction(slug: string, formData: FormData) {
  const { ctx, supabase } = await requireAdmin(slug);
  const repo = customersRepo(supabase);
  await repo.create(ctx.tenant.id, {
    name: (formData.get("name") as string).trim(),
    domain: (formData.get("domain") as string | null) || null,
    tier: (formData.get("tier") as string | null) || null,
    arr_usd: formData.get("arr_usd") ? Number(formData.get("arr_usd")) : null,
    notes: (formData.get("notes") as string | null) || null,
  });
  revalidatePath(`/${slug}/customers`);
}

export async function updateCustomerAction(slug: string, id: string, formData: FormData) {
  const { ctx, supabase } = await requireAdmin(slug);
  const repo = customersRepo(supabase);
  await repo.update(ctx.tenant.id, id, {
    name: (formData.get("name") as string).trim(),
    domain: (formData.get("domain") as string | null) || null,
    tier: (formData.get("tier") as string | null) || null,
    arr_usd: formData.get("arr_usd") ? Number(formData.get("arr_usd")) : null,
    notes: (formData.get("notes") as string | null) || null,
  });
  revalidatePath(`/${slug}/customers`);
}

export async function deleteCustomerAction(slug: string, id: string) {
  const { ctx, supabase } = await requireAdmin(slug);
  await customersRepo(supabase).delete(ctx.tenant.id, id);
  revalidatePath(`/${slug}/customers`);
}

export async function linkIssueAction(slug: string, issueId: string, customerId: string, affectedCount?: number | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot link issues");
  const supabase = await createSupabaseServerClient();
  await customersRepo(supabase).linkIssue(ctx.tenant.id, issueId, customerId, affectedCount);
  revalidatePath(`/${slug}/issues`);
}

export async function unlinkIssueAction(slug: string, issueId: string, customerId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot unlink issues");
  const supabase = await createSupabaseServerClient();
  await customersRepo(supabase).unlinkIssue(ctx.tenant.id, issueId, customerId);
  revalidatePath(`/${slug}/issues`);
}
