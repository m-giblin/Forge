import type { SupabaseClient } from "@supabase/supabase-js";

export type SprintStatus = "planned" | "active" | "completed";

export type Sprint = {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  epicId: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(r: Record<string, unknown>): Sprint {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    goal: (r.goal as string | null) ?? null,
    status: r.status as SprintStatus,
    startDate: (r.start_date as string | null) ?? null,
    endDate: (r.end_date as string | null) ?? null,
    epicId: (r.epic_id as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

const COLS = "id, tenant_id, project_id, name, goal, status, start_date, end_date, epic_id, created_at, updated_at";

export function sprintsRepo(supabase: SupabaseClient) {
  return {
    async listForProject(tenantId: string, projectId: string): Promise<Sprint[]> {
      const { data, error } = await supabase
        .from("sprints")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async getActive(tenantId: string, projectId: string): Promise<Sprint | null> {
      const { data, error } = await supabase
        .from("sprints")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as Record<string, unknown>) : null;
    },

    async create(input: {
      tenantId: string;
      projectId: string;
      name: string;
      goal?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      epicId?: string | null;
    }): Promise<Sprint> {
      const { data, error } = await supabase
        .from("sprints")
        .insert({
          tenant_id: input.tenantId,
          project_id: input.projectId,
          name: input.name,
          goal: input.goal ?? null,
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          epic_id: input.epicId ?? null,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },

    async update(
      tenantId: string,
      sprintId: string,
      patch: { name?: string; goal?: string | null; status?: SprintStatus; startDate?: string | null; endDate?: string | null; epicId?: string | null }
    ): Promise<void> {
      const { error } = await supabase
        .from("sprints")
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.startDate !== undefined ? { start_date: patch.startDate } : {}),
          ...(patch.endDate !== undefined ? { end_date: patch.endDate } : {}),
          ...(patch.epicId !== undefined ? { epic_id: patch.epicId } : {}),
        })
        .eq("tenant_id", tenantId)
        .eq("id", sprintId);
      if (error) throw error;
    },

    async delete(tenantId: string, sprintId: string): Promise<void> {
      const { error } = await supabase
        .from("sprints")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", sprintId);
      if (error) throw error;
    },

    async addIssue(sprintId: string, tenantId: string, issueId: string): Promise<void> {
      const { error } = await supabase
        .from("issues")
        .update({ sprint_id: sprintId })
        .eq("tenant_id", tenantId)
        .eq("id", issueId);
      if (error) throw error;
    },

    async removeIssue(tenantId: string, issueId: string): Promise<void> {
      const { error } = await supabase
        .from("issues")
        .update({ sprint_id: null })
        .eq("tenant_id", tenantId)
        .eq("id", issueId);
      if (error) throw error;
    },

    async countByStatus(tenantId: string, sprintId: string): Promise<{ done: number; total: number }> {
      const { data, error } = await supabase
        .from("issues")
        .select("status")
        .eq("tenant_id", tenantId)
        .eq("sprint_id", sprintId);
      if (error) throw error;
      const rows = (data ?? []) as { status: string }[];
      return { done: rows.filter((r) => r.status === "done").length, total: rows.length };
    },

    /** Velocity: issues completed per sprint (last N completed sprints). */
    async velocity(tenantId: string, projectId: string, limit = 8): Promise<{ name: string; done: number }[]> {
      const { data: sprints, error } = await supabase
        .from("sprints")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const result: { name: string; done: number }[] = [];
      for (const s of (sprints ?? []).reverse()) {
        const { done } = await this.countByStatus(tenantId, s.id);
        result.push({ name: s.name, done });
      }
      return result;
    },
  };
}
