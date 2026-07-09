"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { issueScimToken, revokeScimToken, getScimTokenStatus } from "@/lib/services/scim";

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Admins only.");
}

export async function getScimStatusAction(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  return getScimTokenStatus(ctx.tenant.id);
}

/** Generates (or regenerates) the tenant's SCIM bearer token. The raw value is returned once — Forge never stores it in plaintext. */
export async function generateScimTokenAction(slug: string): Promise<string> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
  const token = await issueScimToken(ctx.tenant.id);
  revalidatePath(`/${slug}/admin/settings/sso`);
  return token;
}

export async function revokeScimTokenAction(slug: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
  await revokeScimToken(ctx.tenant.id);
  revalidatePath(`/${slug}/admin/settings/sso`);
}
