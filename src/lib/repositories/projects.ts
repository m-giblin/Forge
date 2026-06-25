import type { SupabaseClient } from "@supabase/supabase-js";

// lead_user_id is the project "Owner" in the UI. start_date / target_go_live
// come from the intake form — "dates trigger everything".
export type ProjectStatus = "active" | "on_hold" | "closed" | "archived";

export type Project = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  lead_user_id: string | null;
  start_date: string | null;
  target_go_live: string | null;
  linked_idea_id: string | null;
  budget_cents: number | null;
  archived_at?: string | null;
  created_at?: string;
};

const COLS = "id, key, name, description, status, lead_user_id, start_date, target_go_live, linked_idea_id, budget_cents, archived_at, created_at";

export type CreateProjectInput = {
  tenant_id: string;
  key: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  lead_user_id?: string | null;
  start_date?: string | null;
  target_go_live?: string | null;
};

/** Project data access. Always tenant-scoped. The only layer touching the DB. */
export function projectsRepo(supabase: SupabaseClient) {
  return {
    async getByKey(tenantId: string, key: string): Promise<Project | null> {
      const { data, error } = await supabase
        .from("projects")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return (data as Project) ?? null;
    },

    async getById(tenantId: string, id: string): Promise<Project | null> {
      const { data, error } = await supabase
        .from("projects")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Project) ?? null;
    },

    /** First project for the tenant — the default target when none is specified. */
    async getDefault(tenantId: string): Promise<Project | null> {
      const { data, error } = await supabase
        .from("projects")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Project) ?? null;
    },

    /** Every project in the tenant. Pass statuses to filter; omit for all non-archived. */
    async listByTenant(tenantId: string, statuses?: ProjectStatus[]): Promise<Project[]> {
      const filter = statuses ?? (["active", "on_hold", "closed"] as ProjectStatus[]);
      const { data, error } = await supabase
        .from("projects")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .in("status", filter)
        .order("key");
      if (error) throw error;
      return (data ?? []) as Project[];
    },

    /** Projects a specific user is a team member of (non-admin landing view). Excludes archived. */
    async listForMember(tenantId: string, userId: string): Promise<Project[]> {
      const { data, error } = await supabase
        .from("projects")
        .select(`${COLS}, project_members!inner(user_id)`)
        .eq("tenant_id", tenantId)
        .eq("project_members.user_id", userId)
        .neq("status", "archived")
        .order("key");
      if (error) throw error;
      // Strip the joined relation off each row.
      return (data ?? []).map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        status: row.status,
        lead_user_id: row.lead_user_id,
        start_date: row.start_date,
        target_go_live: row.target_go_live,
        linked_idea_id: row.linked_idea_id,
        budget_cents: row.budget_cents,
        created_at: row.created_at,
      })) as Project[];
    },

    async create(input: CreateProjectInput): Promise<Project> {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          tenant_id: input.tenant_id,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          status: input.status ?? "active",
          lead_user_id: input.lead_user_id ?? null,
          start_date: input.start_date ?? null,
          target_go_live: input.target_go_live ?? null,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return data as Project;
    },

    async setLinkedIdea(tenantId: string, projectId: string, ideaId: string): Promise<void> {
      const { error } = await supabase
        .from("projects")
        .update({ linked_idea_id: ideaId })
        .eq("tenant_id", tenantId)
        .eq("id", projectId);
      if (error) throw error;
    },

    async setBudget(tenantId: string, projectId: string, budgetCents: number | null): Promise<void> {
      const { error } = await supabase
        .from("projects")
        .update({ budget_cents: budgetCents })
        .eq("tenant_id", tenantId)
        .eq("id", projectId);
      if (error) throw error;
    },

    async updateStatus(tenantId: string, projectId: string, status: ProjectStatus): Promise<void> {
      const { error } = await supabase
        .from("projects")
        .update({ status })
        .eq("tenant_id", tenantId)
        .eq("id", projectId);
      if (error) throw error;
    },

    async update(tenantId: string, projectId: string, patch: { name?: string; description?: string | null }): Promise<void> {
      const { error } = await supabase
        .from("projects")
        .update(patch)
        .eq("tenant_id", tenantId)
        .eq("id", projectId);
      if (error) throw error;
    },

    async deleteById(tenantId: string, projectId: string): Promise<void> {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", projectId);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Project spend repo (Costs tab) — simple budget + spend, money in integer cents
// ---------------------------------------------------------------------------

export type ProjectSpend = {
  id: string;
  item: string;
  category: string | null;
  amountCents: number;
  spentOn: string;
  createdAt: string;
};

export function projectSpendRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, projectId: string): Promise<ProjectSpend[]> {
      const { data, error } = await supabase
        .from("project_spend")
        .select("id, item, category, amount_cents, spent_on, created_at")
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        item: r.item,
        category: r.category,
        amountCents: r.amount_cents,
        spentOn: r.spent_on,
        createdAt: r.created_at,
      }));
    },

    async add(input: {
      tenantId: string;
      projectId: string;
      item: string;
      category: string | null;
      amountCents: number;
      spentOn: string | null;
      createdBy: string;
    }): Promise<void> {
      const { error } = await supabase.from("project_spend").insert({
        tenant_id: input.tenantId,
        project_id: input.projectId,
        item: input.item,
        category: input.category,
        amount_cents: input.amountCents,
        spent_on: input.spentOn || undefined,
        created_by: input.createdBy,
      });
      if (error) throw error;
    },

    async remove(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("project_spend").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}

export interface ProjectWikiPage {
  id: string;
  projectId: string;
  title: string;
  body: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function projectWikiPagesRepo(supabase: SupabaseClient) {
  return {
    async getForProject(tenantId: string, projectId: string): Promise<ProjectWikiPage | null> {
      const { data, error } = await supabase
        .from("project_wiki_pages")
        .select("id, project_id, title, body, updated_by, updated_at")
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        body: data.body,
        updatedBy: data.updated_by,
        updatedAt: data.updated_at,
      };
    },

    async createForProject(
      tenantId: string,
      projectId: string,
      userId: string,
      title: string,
      body: string,
    ): Promise<void> {
      const { error } = await supabase.from("project_wiki_pages").insert({
        tenant_id: tenantId,
        project_id: projectId,
        title,
        body,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },

    async update(
      tenantId: string,
      projectId: string,
      userId: string,
      body: string,
    ): Promise<void> {
      const { error } = await supabase
        .from("project_wiki_pages")
        .update({ body, updated_by: userId })
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId);
      if (error) throw error;
    },
  };
}
