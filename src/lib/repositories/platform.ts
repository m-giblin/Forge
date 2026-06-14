import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantStat = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  plan: string;
  created_at: string;
  member_count: number;
  issue_count: number;
};

export type AuditRawRow = {
  id: string;
  tenant_id: string | null;
  action: string;
  target: string | null;
  actor_label: string | null;
  created_at: string;
  actor: { email: string } | { email: string }[] | null;
};

/**
 * Cross-tenant platform data access. MUST only ever be called with a
 * service-role client AND after requireSuperAdmin() has passed. This is the one
 * layer that intentionally reads across tenants.
 */
export function platformRepo(supabase: SupabaseClient) {
  return {
    async listTenants(): Promise<TenantStat[]> {
      const { data, error } = await supabase
        .from("tenant_stats")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantStat[];
    },

    async insertTenant(name: string, slug: string): Promise<{ id: string; slug: string }> {
      const { data, error } = await supabase
        .from("tenants")
        .insert({ name, slug })
        .select("id, slug")
        .single();
      if (error) throw error;
      return data as { id: string; slug: string };
    },

    async setStatus(id: string, status: "active" | "suspended"): Promise<void> {
      const { error } = await supabase.from("tenants").update({ status }).eq("id", id);
      if (error) throw error;
    },

    async deleteTenant(id: string): Promise<void> {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },

    async getSlug(id: string): Promise<string | null> {
      const { data } = await supabase.from("tenants").select("slug").eq("id", id).maybeSingle();
      return data?.slug ?? null;
    },

    async listAuditByTenant(tenantId: string, limit = 100): Promise<AuditRawRow[]> {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, tenant_id, action, target, actor_label, created_at, actor:users(email)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AuditRawRow[];
    },

    async listAuditAll(limit = 200): Promise<AuditRawRow[]> {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, tenant_id, action, target, actor_label, created_at, actor:users(email)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AuditRawRow[];
    },

    async writeAudit(entry: {
      tenant_id: string | null;
      actor_user_id: string | null;
      actor_label: string | null;
      action: string;
      target?: string | null;
      metadata?: Record<string, unknown>;
    }): Promise<void> {
      const { error } = await supabase.from("audit_log").insert({
        tenant_id: entry.tenant_id,
        actor_user_id: entry.actor_user_id,
        actor_label: entry.actor_label,
        action: entry.action,
        target: entry.target ?? null,
        metadata: entry.metadata ?? {},
      });
      if (error) throw error;
    },
  };
}
