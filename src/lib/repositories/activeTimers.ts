import type { SupabaseClient } from "@supabase/supabase-js";

export type ActiveTimer = {
  id: string;
  tenant_id: string;
  user_id: string;
  issue_id: string;
  started_at: string;
};

export function activeTimersRepo(supabase: SupabaseClient) {
  return {
    async getForUser(tenantId: string, userId: string): Promise<ActiveTimer | null> {
      const { data } = await supabase
        .from("active_timers")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();
      return data ?? null;
    },

    async start(tenantId: string, userId: string, issueId: string): Promise<ActiveTimer> {
      const { data, error } = await supabase
        .from("active_timers")
        .upsert(
          { tenant_id: tenantId, user_id: userId, issue_id: issueId, started_at: new Date().toISOString() },
          { onConflict: "tenant_id,user_id" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ActiveTimer;
    },

    async stop(tenantId: string, userId: string): Promise<ActiveTimer | null> {
      const { data: existing } = await supabase
        .from("active_timers")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) return null;
      await supabase
        .from("active_timers")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);
      return existing as ActiveTimer;
    },
  };
}
