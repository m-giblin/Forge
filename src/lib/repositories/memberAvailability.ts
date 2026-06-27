import type { SupabaseClient } from "@supabase/supabase-js";

export type MemberAvailability = {
  id: string;
  tenant_id: string;
  user_id: string;
  hours_per_week: number;
  work_days: number[];
  updated_at: string;
};

export function memberAvailabilityRepo(supabase: SupabaseClient) {
  return {
    async listByTenant(tenantId: string): Promise<MemberAvailability[]> {
      const { data } = await supabase
        .from("member_availability")
        .select("*")
        .eq("tenant_id", tenantId);
      return (data ?? []) as MemberAvailability[];
    },

    async getForUser(tenantId: string, userId: string): Promise<MemberAvailability | null> {
      const { data } = await supabase
        .from("member_availability")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();
      return data ?? null;
    },

    async upsert(tenantId: string, userId: string, hours_per_week: number, work_days: number[]): Promise<MemberAvailability> {
      const { data, error } = await supabase
        .from("member_availability")
        .upsert(
          { tenant_id: tenantId, user_id: userId, hours_per_week, work_days, updated_at: new Date().toISOString() },
          { onConflict: "tenant_id,user_id" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as MemberAvailability;
    },
  };
}
