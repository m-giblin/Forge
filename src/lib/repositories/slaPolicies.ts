import type { SupabaseClient } from "@supabase/supabase-js";

export type SlaTier = {
  type: "response" | "resolution";
  hours: number;
  action: "notify" | "reassign";
  target_label?: string;
};

export type SlaPolicy = {
  id: string;
  tenant_id: string;
  name: string;
  conditions: { priority?: string[] };
  tiers: SlaTier[];
  enabled: boolean;
  created_at: string;
};

export type SlaEvent = {
  id: string;
  tenant_id: string;
  issue_id: string;
  policy_id: string;
  event_type: string;
  tier_hours: number | null;
  triggered_at: string;
};

export function slaPoliciesRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<SlaPolicy[]> {
      const { data } = await supabase
        .from("sla_policies")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      return (data ?? []) as SlaPolicy[];
    },

    async listEnabled(tenantId: string): Promise<SlaPolicy[]> {
      const { data } = await supabase
        .from("sla_policies")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("enabled", true);
      return (data ?? []) as SlaPolicy[];
    },

    async create(
      tenantId: string,
      input: { name: string; conditions: SlaPolicy["conditions"]; tiers: SlaTier[]; enabled?: boolean }
    ): Promise<SlaPolicy> {
      const { data, error } = await supabase
        .from("sla_policies")
        .insert({ tenant_id: tenantId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data as SlaPolicy;
    },

    async update(
      tenantId: string,
      id: string,
      patch: Partial<Pick<SlaPolicy, "name" | "conditions" | "tiers" | "enabled">>
    ): Promise<SlaPolicy> {
      const { data, error } = await supabase
        .from("sla_policies")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) throw error;
      return data as SlaPolicy;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      await supabase.from("sla_policies").delete().eq("id", id).eq("tenant_id", tenantId);
    },

    async insertEvent(event: Omit<SlaEvent, "id" | "triggered_at">): Promise<void> {
      await supabase.from("sla_events").insert(event);
    },

    async listEvents(tenantId: string, issueId: string): Promise<SlaEvent[]> {
      const { data } = await supabase
        .from("sla_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("triggered_at", { ascending: false });
      return (data ?? []) as SlaEvent[];
    },

    async complianceRate(tenantId: string, days = 30): Promise<number> {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const [total, breaches] = await Promise.all([
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", since),
        supabase
          .from("sla_events")
          .select("issue_id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .like("event_type", "%breach%")
          .gte("triggered_at", since),
      ]);
      const t = total.count ?? 0;
      const b = breaches.count ?? 0;
      if (t === 0) return 100;
      return Math.round(((t - b) / t) * 100);
    },
  };
}
