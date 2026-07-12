"use server";

import { getTenantContext } from "@/lib/auth";
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

  return askEmber(ctx.tenant.id, trimmed, role);
}
