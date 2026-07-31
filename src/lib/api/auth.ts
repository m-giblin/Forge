import "server-only";
import { after } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { hashKey, parseBearer } from "@/lib/api/keys";

export type ApiAuthResult =
  | { ok: true; tenantId: string; keyId: string; scopes: string[] }
  | { ok: false; code: "unauthorized" | "forbidden"; message: string };

// Pure helpers (hashKey, hasScope, parseBearer) live in ./keys so they are
// unit-testable without the server-only boundary. Re-export for callers.
export { hashKey, hasScope } from "@/lib/api/keys";

/**
 * Authenticate a tenant-scoped API key (machine path). Resolves the key to
 * exactly one tenant + its scopes. The caller then uses the service-role
 * client and MUST scope every query to the returned tenantId — RLS does not
 * protect this path.
 */
export async function authenticateApiKey(req: Request): Promise<ApiAuthResult> {
  const raw = parseBearer(req.headers.get("authorization") || req.headers.get("Authorization"));
  if (!raw) return { ok: false, code: "unauthorized", message: "Missing API key (Authorization: Bearer <key>)." };

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, tenant_id, scopes, revoked_at, expires_at")
    .eq("key_hash", hashKey(raw))
    .maybeSingle();

  if (error || !data) return { ok: false, code: "unauthorized", message: "Invalid API key." };
  if (data.revoked_at) return { ok: false, code: "unauthorized", message: "API key has been revoked." };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ok: false, code: "unauthorized", message: "API key has expired. Rotate your key in Settings → API Keys." };
  }

  // Best-effort last-used timestamp + call log; scheduled via after() so it isn't
  // dropped once the response is sent (bare fire-and-forget promises aren't
  // guaranteed to run to completion post-response — see next/server's after()).
  const keyId = data.id;
  const tenantId = data.tenant_id;
  after(async () => {
    await Promise.allSettled([
      supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyId),
      supabase.from("api_call_events").insert({ tenant_id: tenantId, key_id: keyId }),
    ]);
  });

  return { ok: true, tenantId: data.tenant_id, keyId: data.id, scopes: data.scopes ?? [] };
}
