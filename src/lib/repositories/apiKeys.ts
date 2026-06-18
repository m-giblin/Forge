import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const COLS = "id, name, key_prefix, scopes, last_used_at, revoked_at, expires_at, created_at";

/**
 * API key data access. On the human (admin UI) path these go through the
 * user-JWT client, so RLS restricts management to owner/admin of the tenant.
 * Still tenant-scoped explicitly. The only layer that touches the DB.
 */
export function apiKeysRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<ApiKeyRow[]> {
      const { data, error } = await supabase
        .from("api_keys")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApiKeyRow[];
    },

    async create(input: {
      tenant_id: string;
      name: string;
      key_prefix: string;
      key_hash: string;
      scopes: string[];
      expires_at?: string | null;
      created_by?: string | null;
    }): Promise<ApiKeyRow> {
      const { data, error } = await supabase.from("api_keys").insert(input).select(COLS).single();
      if (error) throw error;
      return data as ApiKeyRow;
    },

    async revoke(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .is("revoked_at", null);
      if (error) throw error;
    },
  };
}
