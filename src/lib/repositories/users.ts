import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export function usersRepo(supabase: SupabaseClient) {
  return {
    /**
     * SECURITY INVARIANT: this has no tenant scoping — it returns name/email
     * for any user id, cross-tenant. It's only safe because every current
     * caller builds `ids` from data that was already tenant-scoped upstream
     * (e.g. participants of a tenant-scoped thread). Do NOT pass ids sourced
     * from user input or another tenant's data without adding a
     * membership/tenant_id check here first — that would leak PII cross-tenant.
     */
    async getDisplayNames(ids: string[]): Promise<Map<string, string>> {
      if (ids.length === 0) return new Map();
      const { data } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", ids);
      return new Map(
        (data ?? []).map((u: { id: string; name: string | null; email: string | null }) => [
          u.id,
          u.name ?? u.email ?? u.id,
        ])
      );
    },
  };
}
