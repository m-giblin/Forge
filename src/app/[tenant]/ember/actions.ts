"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { askEmber, type EmberAnswer } from "@/lib/services/emberAssistant";

export async function askEmberAction(slug: string, question: string): Promise<EmberAnswer> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const trimmed = question.trim();
  if (!trimmed) throw new Error("Ask Ember something first.");
  if (trimmed.length > 500) throw new Error("Keep questions under 500 characters.");

  const role = (ctx.role === "owner" || ctx.role === "admin" || ctx.role === "member" || ctx.role === "viewer"
    ? ctx.role
    : "viewer") as "owner" | "admin" | "member" | "viewer";

  const supabase = await createSupabaseServerClient();
  return askEmber(supabase, ctx.tenant.id, ctx.appUserId, trimmed, role);
}
