"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createApiKey, revokeApiKey } from "@/lib/services/apiKeys";
import { recordAudit } from "@/lib/audit";

// API key management is owner/admin only. Re-checked here AND enforced by RLS.

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Only owners and admins manage API keys.");
}

export async function createApiKeyAction(slug: string, input: { name: string; scopes: string[] }) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
  if (!input.name.trim()) throw new Error("Name is required.");

  const { raw } = await createApiKey({
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    name: input.name.trim(),
    scopes: input.scopes,
    createdBy: ctx.appUserId,
  });
  await recordAudit({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.appUserId,
    action: "apikey.create",
    target: input.name.trim(),
  });
  revalidatePath(`/${slug}/admin/api-keys`);
  return { raw }; // shown once in the UI
}

export async function revokeApiKeyAction(slug: string, id: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertAdmin(ctx.role);
  await revokeApiKey(ctx.tenant.id, id);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "apikey.revoke", target: id });
  revalidatePath(`/${slug}/admin/api-keys`);
}
