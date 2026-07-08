"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: SSO config write bypasses RLS for admin-only settings
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ssoConfigRepo } from "@/lib/repositories/ssoConfig";
import type { SsoConfigPatch } from "@/lib/repositories/ssoConfig";
import { createSamlProvider, updateSamlProvider, deleteSamlProvider } from "@/lib/services/samlSso";

export async function saveSsoConfigAction(slug: string, patch: SsoConfigPatch): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx || !["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");

  // Normalise domain: strip @ prefix, lowercase, empty string → null
  if (patch.allowed_domain !== undefined) {
    const d = patch.allowed_domain?.replace(/^@/, "").trim().toLowerCase() || null;
    patch = { ...patch, allowed_domain: d };
  }

  await ssoConfigRepo(createSupabaseServiceClient()).upsert(ctx.tenant.id, patch);
}

/**
 * Registers (or re-registers) a real SAML 2.0 identity provider with Supabase
 * for this tenant's domain. Returns an error string on failure instead of
 * throwing, so the settings UI can show it inline without a page crash —
 * IdP metadata is exactly the kind of input that's often malformed on the
 * first try.
 */
export async function saveSamlProviderAction(
  slug: string,
  input: { domain: string; metadataUrl?: string | null; metadataXml?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx || !["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");

  const domain = input.domain.trim().toLowerCase();
  if (!domain) return { ok: false, error: "A domain is required (e.g. acme.com)." };

  const svc = createSupabaseServiceClient();
  const repo = ssoConfigRepo(svc);
  const existing = await repo.get(ctx.tenant.id);

  const result = existing?.supabase_sso_provider_id
    ? await updateSamlProvider({
        providerId: existing.supabase_sso_provider_id,
        domain,
        metadataUrl: input.metadataUrl,
        metadataXml: input.metadataXml,
      })
    : await createSamlProvider({ domain, metadataUrl: input.metadataUrl, metadataXml: input.metadataXml });

  if (!result.ok) return { ok: false, error: result.message };

  await repo.upsert(ctx.tenant.id, {
    provider: "saml",
    enabled: true,
    allowed_domain: domain,
    sso_domain: domain,
    saml_metadata_url: input.metadataUrl?.trim() || null,
    saml_metadata_xml: input.metadataXml?.trim() || null,
    supabase_sso_provider_id: result.providerId,
  });

  revalidatePath(`/${slug}/admin/settings/sso`);
  return { ok: true };
}

/** Removes the tenant's SAML provider from Supabase and clears local config. */
export async function deleteSamlProviderAction(slug: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx || !["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");

  const svc = createSupabaseServiceClient();
  const repo = ssoConfigRepo(svc);
  const existing = await repo.get(ctx.tenant.id);
  if (existing?.supabase_sso_provider_id) {
    await deleteSamlProvider(existing.supabase_sso_provider_id);
  }
  await repo.upsert(ctx.tenant.id, {
    enabled: false,
    saml_metadata_url: null,
    saml_metadata_xml: null,
    supabase_sso_provider_id: null,
    sso_domain: null,
  });
  revalidatePath(`/${slug}/admin/settings/sso`);
}
