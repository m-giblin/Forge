import "server-only";

// Wraps Supabase's own SSO Admin API (GoTrue) rather than parsing/validating
// SAML assertions ourselves — Supabase's auth backend already does the
// security-sensitive part (signature verification, assertion parsing).
// Verified live on 2026-07-08: GET /auth/v1/admin/sso/providers returns 200
// on this project, so the feature is already enabled — no Supabase support
// ticket needed.

function adminHeaders(): HeadersInit {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return `${url}/auth/v1/admin/sso/providers`;
}

export type SsoProviderResult =
  | { ok: true; providerId: string }
  | { ok: false; message: string };

/** Registers a new SAML IdP with Supabase for the given domain. */
export async function createSamlProvider(input: {
  domain: string;
  metadataUrl?: string | null;
  metadataXml?: string | null;
}): Promise<SsoProviderResult> {
  if (!input.metadataUrl && !input.metadataXml) {
    return { ok: false, message: "Provide either a metadata URL or metadata XML." };
  }
  try {
    const res = await fetch(baseUrl(), {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        type: "saml",
        domains: [input.domain],
        ...(input.metadataUrl ? { metadata_url: input.metadataUrl } : { metadata_xml: input.metadataXml }),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: body?.message ?? body?.msg ?? `Supabase rejected the provider (HTTP ${res.status}).` };
    }
    if (!body?.id) return { ok: false, message: "Supabase did not return a provider id." };
    return { ok: true, providerId: body.id as string };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Updates an existing provider's metadata or domain mapping. */
export async function updateSamlProvider(input: {
  providerId: string;
  domain: string;
  metadataUrl?: string | null;
  metadataXml?: string | null;
}): Promise<SsoProviderResult> {
  try {
    const res = await fetch(`${baseUrl()}/${input.providerId}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify({
        domains: [input.domain],
        ...(input.metadataUrl ? { metadata_url: input.metadataUrl } : {}),
        ...(input.metadataXml ? { metadata_xml: input.metadataXml } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: body?.message ?? body?.msg ?? `Supabase rejected the update (HTTP ${res.status}).` };
    }
    return { ok: true, providerId: input.providerId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Removes a tenant's SAML provider from Supabase entirely. */
export async function deleteSamlProvider(providerId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${baseUrl()}/${providerId}`, { method: "DELETE", headers: adminHeaders() });
    if (!res.ok && res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, message: body?.message ?? `Supabase rejected the delete (HTTP ${res.status}).` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
