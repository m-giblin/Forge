"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { tenantAiKeysRepo, type AIProvider } from "@/lib/repositories/aiKeys";
import { revalidatePath } from "next/cache";

function requireAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Admin access required.");
}

export async function saveAiKeyAction(
  slug: string,
  provider: AIProvider,
  apiKey: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key cannot be empty.");
  if (trimmed.length < 10) throw new Error("API key is too short.");

  const svc = createSupabaseServiceClient();
  await tenantAiKeysRepo(svc).setKey(ctx.tenant.id, provider, trimmed, ctx.appUserId);
  revalidatePath(`/${slug}/admin/settings/ai`);
}

export async function selectAiProviderAction(
  slug: string,
  provider: AIProvider
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const svc = createSupabaseServiceClient();
  const has = await tenantAiKeysRepo(svc).hasKey(ctx.tenant.id, provider);
  if (!has) throw new Error("No saved key for this provider.");

  await tenantAiKeysRepo(svc).selectProvider(ctx.tenant.id, provider);
  revalidatePath(`/${slug}/admin/settings/ai`);
}

export async function deleteAiKeyAction(
  slug: string,
  provider: AIProvider
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  const svc = createSupabaseServiceClient();
  await tenantAiKeysRepo(svc).deleteKey(ctx.tenant.id, provider);
  revalidatePath(`/${slug}/admin/settings/ai`);
}

export async function resetToDefaultAction(slug: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx.role);

  // Deselect all keys — sounding board falls back to platform Grok.
  const svc = createSupabaseServiceClient();
  await svc
    .from("tenant_ai_keys")
    .update({ is_selected: false })
    .eq("tenant_id", ctx.tenant.id);
  revalidatePath(`/${slug}/admin/settings/ai`);
}
