import type { SupabaseClient } from "@supabase/supabase-js";

// Feature flags are service-role only (no RLS), like platform_settings. The
// gating helper and the super-admin UI are the only callers.

export type FeatureFlag = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean; // global default
};

export type TenantOverride = { tenantId: string; key: string; enabled: boolean };

export function featureFlagsRepo(supabase: SupabaseClient) {
  return {
    async listFlags(): Promise<FeatureFlag[]> {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, label, description, enabled")
        .order("key");
      if (error) throw error;
      return (data ?? []) as FeatureFlag[];
    },

    async setGlobal(key: string, enabled: boolean): Promise<void> {
      const { error } = await supabase.from("feature_flags").update({ enabled }).eq("key", key);
      if (error) throw error;
    },

    async listOverrides(): Promise<TenantOverride[]> {
      const { data, error } = await supabase
        .from("tenant_feature_overrides")
        .select("tenant_id, key, enabled");
      if (error) throw error;
      return (data ?? []).map((r) => ({ tenantId: r.tenant_id, key: r.key, enabled: r.enabled }));
    },

    async listOverridesForTenant(tenantId: string): Promise<TenantOverride[]> {
      const { data, error } = await supabase
        .from("tenant_feature_overrides")
        .select("tenant_id, key, enabled")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return (data ?? []).map((r) => ({ tenantId: r.tenant_id, key: r.key, enabled: r.enabled }));
    },

    /** Set an override, or clear it (enabled = null) to fall back to the global default. */
    async setOverride(tenantId: string, key: string, enabled: boolean | null): Promise<void> {
      if (enabled === null) {
        const { error } = await supabase
          .from("tenant_feature_overrides")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("key", key);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("tenant_feature_overrides")
        .upsert({ tenant_id: tenantId, key, enabled }, { onConflict: "tenant_id,key" });
      if (error) throw error;
    },
  };
}
