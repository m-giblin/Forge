import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export function usersRepo(supabase: SupabaseClient) {
  return {
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
