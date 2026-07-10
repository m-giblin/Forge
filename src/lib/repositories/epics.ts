import type { SupabaseClient } from "@supabase/supabase-js";

export type EpicStatus = "planned" | "active" | "done";

export type Epic = {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: EpicStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(r: Record<string, unknown>): Epic {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    projectId: r.project_id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    status: r.status as EpicStatus,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

const COLS = "id, tenant_id, project_id, title, description, status, created_by, created_at, updated_at";

export function epicsRepo(supabase: SupabaseClient) {
  return {
    async listForProject(tenantId: string, projectId: string): Promise<Epic[]> {
      const { data, error } = await supabase
        .from("epics")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async getById(tenantId: string, epicId: string): Promise<Epic | null> {
      const { data, error } = await supabase
        .from("epics")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("id", epicId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as Record<string, unknown>) : null;
    },

    async create(input: {
      tenantId: string;
      projectId: string;
      title: string;
      description?: string | null;
      createdBy?: string | null;
    }): Promise<Epic> {
      const { data, error } = await supabase
        .from("epics")
        .insert({
          tenant_id: input.tenantId,
          project_id: input.projectId,
          title: input.title,
          description: input.description ?? null,
          created_by: input.createdBy ?? null,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },

    async update(
      tenantId: string,
      epicId: string,
      patch: { title?: string; description?: string | null; status?: EpicStatus }
    ): Promise<void> {
      const { error } = await supabase
        .from("epics")
        .update({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
        })
        .eq("tenant_id", tenantId)
        .eq("id", epicId);
      if (error) throw error;
    },

    async delete(tenantId: string, epicId: string): Promise<void> {
      const { error } = await supabase
        .from("epics")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", epicId);
      if (error) throw error;
    },
  };
}
