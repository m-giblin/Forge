"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: rates admin bypass RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type BillingRate = {
  id: string;
  userId: string | null;
  userName: string | null;
  projectId: string | null;
  projectName: string | null;
  roleName: string | null;
  rateCents: number;
  currency: string;
  effectiveFrom: string;
};

export type CostRate = {
  id: string;
  userId: string | null;
  userName: string | null;
  roleName: string | null;
  costCents: number;
  currency: string;
  effectiveFrom: string;
};

export async function getBillingRatesAction(slug: string): Promise<BillingRate[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return [];
  const svc = createSupabaseServiceClient();

  const [{ data: rates }, { data: users }, { data: projects }] = await Promise.all([
    svc.from("billing_rates").select("*").eq("tenant_id", ctx.tenant.id).order("effective_from", { ascending: false }),
    svc.from("users").select("id, name, email"),
    svc.from("projects").select("id, name").eq("tenant_id", ctx.tenant.id),
  ]);

  const userMap = new Map((users ?? []).map((u) => [u.id as string, (u.name ?? u.email ?? "Unknown") as string]));
  const projMap = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  return (rates ?? []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string | null,
    userName: r.user_id ? (userMap.get(r.user_id as string) ?? null) : null,
    projectId: r.project_id as string | null,
    projectName: r.project_id ? (projMap.get(r.project_id as string) ?? null) : null,
    roleName: r.role_name as string | null,
    rateCents: r.rate_cents as number,
    currency: r.currency as string,
    effectiveFrom: r.effective_from as string,
  }));
}

export async function getCostRatesAction(slug: string): Promise<CostRate[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return [];
  const svc = createSupabaseServiceClient();

  const [{ data: rates }, { data: users }] = await Promise.all([
    svc.from("cost_rates").select("*").eq("tenant_id", ctx.tenant.id).order("effective_from", { ascending: false }),
    svc.from("users").select("id, name, email"),
  ]);

  const userMap = new Map((users ?? []).map((u) => [u.id as string, (u.name ?? u.email ?? "Unknown") as string]));

  return (rates ?? []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string | null,
    userName: r.user_id ? (userMap.get(r.user_id as string) ?? null) : null,
    roleName: r.role_name as string | null,
    costCents: r.cost_cents as number,
    currency: r.currency as string,
    effectiveFrom: r.effective_from as string,
  }));
}

export async function upsertBillingRateAction(
  slug: string,
  data: { userId?: string; projectId?: string; roleName?: string; rateCents: number; currency: string; effectiveFrom: string },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return { ok: false, error: "Not authorized" };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("billing_rates").insert({
    tenant_id: ctx.tenant.id,
    user_id: data.userId || null,
    project_id: data.projectId || null,
    role_name: data.roleName || null,
    rate_cents: data.rateCents,
    currency: data.currency,
    effective_from: data.effectiveFrom,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/admin/rates`);
  return { ok: true };
}

export async function upsertCostRateAction(
  slug: string,
  data: { userId?: string; roleName?: string; costCents: number; currency: string; effectiveFrom: string },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return { ok: false, error: "Not authorized" };
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("cost_rates").insert({
    tenant_id: ctx.tenant.id,
    user_id: data.userId || null,
    role_name: data.roleName || null,
    cost_cents: data.costCents,
    currency: data.currency,
    effective_from: data.effectiveFrom,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/admin/rates`);
  return { ok: true };
}

export async function deleteRateAction(
  slug: string,
  table: "billing_rates" | "cost_rates",
  id: string,
): Promise<{ ok: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx || (ctx.role !== "owner" && ctx.role !== "admin")) return { ok: false };
  const svc = createSupabaseServiceClient();
  await svc.from(table).delete().eq("tenant_id", ctx.tenant.id).eq("id", id);
  revalidatePath(`/${slug}/admin/rates`);
  return { ok: true };
}

export type Member = { id: string; name: string };
export type Project = { id: string; name: string };

export async function getRateMembersAndProjectsAction(slug: string): Promise<{ members: Member[]; projects: Project[] }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return { members: [], projects: [] };
  const svc = createSupabaseServiceClient();
  const [{ data: memberships }, { data: projects }] = await Promise.all([
    svc.from("memberships").select("user_id, users!inner(id, name, email)").eq("tenant_id", ctx.tenant.id),
    svc.from("projects").select("id, name").eq("tenant_id", ctx.tenant.id),
  ]);
  const members = (memberships ?? []).map((m) => {
    const u = m.users as unknown as { id: string; name: string | null; email: string | null };
    return { id: u.id, name: u.name ?? u.email ?? "Unknown" };
  });
  return { members, projects: (projects ?? []).map((p) => ({ id: p.id as string, name: p.name as string })) };
}
