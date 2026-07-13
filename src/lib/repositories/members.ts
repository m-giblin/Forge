import type { SupabaseClient } from "@supabase/supabase-js";

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export type MemberRow = {
  membershipId: string;
  role: MembershipRole;
  userId: string;
  email: string;
  name: string | null;
  jobTitles: string[];
  customRoleId: string | null;
  customRoleName: string | null;
  customRoleColor: string | null;
  createdAt: string;
};

export function membersRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<MemberRow[]> {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, role, job_titles, custom_role_id, created_at, user:users!inner(id, email, name), custom_role:custom_roles(id, name, color)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => {
        const u = Array.isArray(m.user) ? m.user[0] : m.user;
        const cr = Array.isArray((m as Record<string, unknown>).custom_role)
          ? ((m as Record<string, unknown>).custom_role as Record<string, unknown>[])[0]
          : (m as Record<string, unknown>).custom_role as Record<string, unknown> | null;
        return {
          membershipId: m.id,
          role: m.role as MembershipRole,
          userId: u.id,
          email: u.email,
          name: u.name,
          jobTitles: ((m as Record<string, unknown>).job_titles as string[] | null) ?? [],
          customRoleId: (m as Record<string, unknown>).custom_role_id as string | null ?? null,
          customRoleName: cr?.name as string | null ?? null,
          customRoleColor: cr?.color as string | null ?? null,
          createdAt: m.created_at,
        };
      });
    },

    /** owner + admin user ids for a tenant — the fan-out list for urgent platform alerts. */
    async listAdminUserIds(tenantId: string): Promise<string[]> {
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .in("role", ["owner", "admin"]);
      if (error) throw error;
      return (data ?? []).map((m) => m.user_id as string);
    },

    async countOwners(tenantId: string): Promise<number> {
      const { count, error } = await supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("role", "owner");
      if (error) throw error;
      return count ?? 0;
    },

    async getById(tenantId: string, membershipId: string) {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, role, user_id")
        .eq("tenant_id", tenantId)
        .eq("id", membershipId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async updateRole(tenantId: string, membershipId: string, role: MembershipRole): Promise<void> {
      const { error } = await supabase
        .from("memberships")
        .update({ role })
        .eq("tenant_id", tenantId)
        .eq("id", membershipId);
      if (error) throw error;
    },

    async remove(tenantId: string, membershipId: string): Promise<void> {
      const { error } = await supabase
        .from("memberships")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", membershipId);
      if (error) throw error;
    },

    /** Add a membership (service-role; invite accept). Idempotent on conflict. */
    async add(tenantId: string, userId: string, role: MembershipRole): Promise<void> {
      const { error } = await supabase
        .from("memberships")
        .upsert({ tenant_id: tenantId, user_id: userId, role }, { onConflict: "tenant_id,user_id", ignoreDuplicates: true });
      if (error) throw error;
    },
  };
}
