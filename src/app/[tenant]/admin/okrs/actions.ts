"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createOkrAction(
  slug: string,
  input: { title: string; description: string; quarter: string; },
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admins only.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("okrs").insert({
    tenant_id: ctx.tenant.id,
    title: input.title,
    description: input.description || null,
    quarter: input.quarter || null,
    owner_id: ctx.appUserId,
    status: "active",
    progress: 0,
  });
  if (error) throw error;
}

export async function updateOkrAction(
  slug: string,
  okrId: string,
  input: { title: string; description: string; quarter: string; status: string; progress: number; },
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admins only.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("okrs")
    .update({ ...input, description: input.description || null, quarter: input.quarter || null, updated_at: new Date().toISOString() })
    .eq("id", okrId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
}

export async function deleteOkrAction(slug: string, okrId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admins only.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("okrs").delete().eq("id", okrId).eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
}
