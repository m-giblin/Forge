import type { SupabaseClient } from "@supabase/supabase-js";

export type ViewFilters = {
  status?: string[];
  priority?: string[];
  assignee?: string[];
  type?: string[];
  q?: string;
  groupBy?: string;
};

export type SavedView = {
  id: string;
  tenantId: string;
  projectId: string | null;
  userId: string | null;
  name: string;
  filters: ViewFilters;
  isShared: boolean;
  isDefault: boolean;
  createdAt: string;
};

export function savedViewsRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, projectId?: string): Promise<SavedView[]> {
      let q = supabase
        .from("issue_saved_views")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },

    async create(input: {
      tenantId: string;
      projectId: string | null;
      userId: string;
      name: string;
      filters: ViewFilters;
      isShared: boolean;
    }): Promise<SavedView> {
      const { data, error } = await supabase
        .from("issue_saved_views")
        .insert({
          tenant_id: input.tenantId,
          project_id: input.projectId,
          user_id: input.userId,
          name: input.name,
          filters: input.filters,
          is_shared: input.isShared,
          is_default: false,
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapRow(data);
    },

    async update(tenantId: string, id: string, patch: Partial<{ name: string; filters: ViewFilters; isShared: boolean; isDefault: boolean }>): Promise<void> {
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.filters !== undefined) dbPatch.filters = patch.filters;
      if (patch.isShared !== undefined) dbPatch.is_shared = patch.isShared;
      if (patch.isDefault !== undefined) dbPatch.is_default = patch.isDefault;
      const { error } = await supabase
        .from("issue_saved_views")
        .update(dbPatch)
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("issue_saved_views")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
  };
}

function mapRow(r: Record<string, unknown>): SavedView {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    projectId: r.project_id as string | null,
    userId: r.user_id as string | null,
    name: r.name as string,
    filters: (r.filters ?? {}) as ViewFilters,
    isShared: r.is_shared as boolean,
    isDefault: r.is_default as boolean,
    createdAt: r.created_at as string,
  };
}
