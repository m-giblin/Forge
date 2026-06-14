import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectMemberRow = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

/** Project-team data access. A project team is a SUBSET of tenant members. */
export function projectMembersRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, projectId: string): Promise<ProjectMemberRow[]> {
      const { data, error } = await supabase
        .from("project_members")
        .select("id, role, created_at, user:users!inner(id, email, name)")
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => {
        const u = Array.isArray(m.user) ? m.user[0] : m.user;
        return {
          id: m.id,
          userId: u.id,
          email: u.email,
          name: u.name,
          role: m.role as string,
          createdAt: m.created_at,
        };
      });
    },

    /** Idempotent add — re-adding an existing member is a no-op. */
    async add(tenantId: string, projectId: string, userId: string, role = "member"): Promise<void> {
      const { error } = await supabase
        .from("project_members")
        .upsert(
          { tenant_id: tenantId, project_id: projectId, user_id: userId, role },
          { onConflict: "project_id,user_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    },

    async remove(tenantId: string, projectId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
    },
  };
}
