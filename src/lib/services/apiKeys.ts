import "server-only";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { apiKeysRepo, type ApiKeyRow } from "@/lib/repositories/apiKeys";
import { hashKey } from "@/lib/api/keys";
import { ALL_SCOPES, type Scope } from "@/lib/api/scopes";

/** List a tenant's API keys. `impersonating` → service-role (super-admin support view). */
export async function listApiKeys(tenantId: string, impersonating = false): Promise<ApiKeyRow[]> {
  const supabase = impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  return apiKeysRepo(supabase).list(tenantId);
}

/**
 * Mint a new key. Returns the RAW key exactly once — it is hashed before
 * storage and never recoverable. RLS enforces owner/admin on the insert.
 */
export async function createApiKey(input: {
  tenantId: string;
  tenantSlug: string;
  name: string;
  scopes: string[];
  createdBy?: string | null;
}): Promise<{ raw: string; key: ApiKeyRow }> {
  const scopes = input.scopes.filter((s): s is Scope => (ALL_SCOPES as string[]).includes(s));
  if (scopes.length === 0) throw new Error("Select at least one scope.");

  const raw = `forge_${input.tenantSlug}_${randomBytes(24).toString("hex")}`;
  const supabase = await createSupabaseServerClient();
  const key = await apiKeysRepo(supabase).create({
    tenant_id: input.tenantId,
    name: input.name,
    key_prefix: raw.slice(0, 20),
    key_hash: hashKey(raw),
    scopes,
    created_by: input.createdBy ?? null,
  });
  return { raw, key };
}

export async function revokeApiKey(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await apiKeysRepo(supabase).revoke(tenantId, id);
}
