import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export function usersRepo(supabase: SupabaseClient) {
  return {
    /**
     * tenantId is required — this joins through memberships so only users
     * who actually belong to that tenant can have their name/email
     * resolved. A prior version filtered by `.in("id", ids)` alone with no
     * tenant check at all; that was safe only by accident (every caller
     * happened to build `ids` from pre-scoped data) and was a PII-leak
     * waiting for the first caller that didn't.
     */
    async getDisplayNames(tenantId: string, ids: string[]): Promise<Map<string, string>> {
      if (ids.length === 0) return new Map();
      const { data } = await supabase
        .from("memberships")
        .select("user_id, users!inner(id, name, email)")
        .eq("tenant_id", tenantId)
        .in("user_id", ids);
      return new Map(
        (data ?? []).map((m) => {
          const u = Array.isArray(m.users) ? m.users[0] : m.users;
          return [u.id as string, (u.name as string | null) ?? (u.email as string | null) ?? (u.id as string)];
        })
      );
    },
  };
}
