"use server";

import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required for AI key management (bypasses RLS by design); all calls go through tenantAiKeysRepo (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { tenantAiKeysRepo, type AIProvider } from "@/lib/repositories/aiKeys";
import { revalidatePath } from "next/cache";
import { ctxCanDo, type RbacPermissionSet } from "@/lib/rbac";
import { getTenantSettings, setTenantSetting } from "@/lib/tenantSettings";

function requireAdmin(ctx: { role: string; customRolePermissions: RbacPermissionSet | null }) {
  const role = ctx.role as "owner" | "admin" | "member" | "viewer";
  if (role !== "owner" && role !== "admin" && !ctxCanDo(ctx as Parameters<typeof ctxCanDo>[0], "manage_settings")) {
    throw new Error("Admin access required.");
  }
}

export async function saveAiKeyAction(
  slug: string,
  provider: AIProvider,
  apiKey: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx);

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
  requireAdmin(ctx);

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
  requireAdmin(ctx);

  const svc = createSupabaseServiceClient();
  await tenantAiKeysRepo(svc).deleteKey(ctx.tenant.id, provider);
  revalidatePath(`/${slug}/admin/settings/ai`);
}

export async function resetToDefaultAction(slug: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx);

  // Deselect all keys — sounding board falls back to platform Grok.
  const svc = createSupabaseServiceClient();
  await tenantAiKeysRepo(svc).deselectAll(ctx.tenant.id);
  revalidatePath(`/${slug}/admin/settings/ai`);
}

// F-05: per-tenant AI-off + optional outbound PII scrub.
export async function getAiPrivacySettingsAction(slug: string): Promise<{ aiDisabled: boolean; piiScrub: boolean }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  const settings = await getTenantSettings(ctx.tenant.id, ["ai_disabled", "ai_pii_scrub"]);
  return { aiDisabled: settings.ai_disabled === "true", piiScrub: settings.ai_pii_scrub === "true" };
}

export async function setAiPrivacySettingsAction(slug: string, aiDisabled: boolean, piiScrub: boolean): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  requireAdmin(ctx);
  await Promise.all([
    setTenantSetting(ctx.tenant.id, "ai_disabled", String(aiDisabled)),
    setTenantSetting(ctx.tenant.id, "ai_pii_scrub", String(piiScrub)),
  ]);
  revalidatePath(`/${slug}/admin/settings/ai`);
}
