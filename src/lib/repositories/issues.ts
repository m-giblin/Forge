import type { SupabaseClient } from "@supabase/supabase-js";

// status/priority/type are per-tenant configurable (tenant_field_options), so
// these are plain strings now. The arrays below are the SEEDED DEFAULTS only.
export type IssueStatus = string;
export type IssuePriority = string;
export type IssueType = string;
export type IssueSource = "web" | "api" | "email";

export const DEFAULT_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done"];
export const DEFAULT_PRIORITIES = ["low", "medium", "high", "urgent"];
export const DEFAULT_TYPES = ["bug", "task", "feature"];

export type Issue = {
  id: string;
  tenant_id: string;
  project_id: string;
  number: number;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  assignee_id: string | null;
  reporter_id: string | null;
  labels: string[];
  environment: string | null;
  app_version: string | null;
  stack_trace: string | null;
  source: IssueSource;
  external_id: string | null;
  category_id: string | null;
  custom_values: Record<string, unknown>;
  position: number;
  start_date: string | null;
  due_date: string | null;
  phase: string | null;
  sprint_id?: string | null;
  parent_id?: string | null;
  triage_suggestion?: TriageSuggestion | null;
  created_at: string;
  updated_at: string;
};

export type TriageSuggestion = {
  priority: string;
  categoryLabel: string | null;
  duplicateTitles: string[];
  reasoning: string;
  generatedAt: string;
};

export type CreateIssueInput = {
  tenant_id: string;
  project_id: string;
  title: string;
  description?: string | null;
  status?: IssueStatus;
  priority?: IssuePriority;
  type?: IssueType;
  assignee_id?: string | null;
  reporter_id?: string | null;
  labels?: string[];
  environment?: string | null;
  app_version?: string | null;
  stack_trace?: string | null;
  source?: IssueSource;
  external_id?: string | null;
  category_id?: string | null;
  custom_values?: Record<string, unknown>;
};

const COLS =
  "id, tenant_id, project_id, number, title, description, status, priority, type, assignee_id, reporter_id, labels, environment, app_version, stack_trace, source, external_id, category_id, custom_values, position, start_date, due_date, phase, sprint_id, parent_id, triage_suggestion, created_at, updated_at";

/**
 * Issue data access. Always tenant-scoped: every query filters on tenant_id
 * explicitly. On the human path RLS also enforces this; on the machine
 * (service-role) path this explicit filter is the ONLY thing protecting
 * isolation, so it is never optional. The ONLY layer that touches the DB.
 */
export function issuesRepo(supabase: SupabaseClient) {
  return {
    async listByTenant(tenantId: string): Promise<Issue[]> {
      const { data, error } = await supabase
        .from("issues")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Issue[];
    },

    async listByProject(tenantId: string, projectId: string): Promise<Issue[]> {
      const { data, error } = await supabase
        .from("issues")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Issue[];
    },

    async get(tenantId: string, id: string): Promise<Issue | null> {
      const { data, error } = await supabase
        .from("issues")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Issue) ?? null;
    },

    // Idempotency lookup: find an existing issue by client-supplied external id.
    async getByExternalId(tenantId: string, externalId: string): Promise<Issue | null> {
      const { data, error } = await supabase
        .from("issues")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("external_id", externalId)
        .maybeSingle();
      if (error) throw error;
      return (data as Issue) ?? null;
    },

    // Filtered, paginated list for the API (newest first). Always tenant-scoped.
    // Returns the page plus the total matching count for offset/limit paging.
    async list(
      tenantId: string,
      opts: { status?: string; projectId?: string; q?: string; limit?: number; offset?: number } = {}
    ): Promise<{ issues: Issue[]; total: number; limit: number; offset: number }> {
      const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
      const offset = Math.max(opts.offset ?? 0, 0);
      let q = supabase.from("issues").select(COLS, { count: "exact" }).eq("tenant_id", tenantId);
      if (opts.status) q = q.eq("status", opts.status);
      if (opts.projectId) q = q.eq("project_id", opts.projectId);
      if (opts.q) q = q.ilike("title", `%${opts.q}%`);
      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return { issues: (data ?? []) as Issue[], total: count ?? 0, limit, offset };
    },

    async create(input: CreateIssueInput): Promise<Issue> {
      const { data, error } = await supabase
        .from("issues")
        .insert({ ...input, labels: input.labels ?? [] })
        .select(COLS)
        .single();
      if (error) throw error;
      return data as Issue;
    },

    async update(
      tenantId: string,
      id: string,
      patch: Partial<Omit<Issue, "id" | "tenant_id" | "number" | "created_at" | "updated_at">>
    ): Promise<Issue> {
      const { data, error } = await supabase
        .from("issues")
        .update(patch)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select(COLS)
        .single();
      if (error) throw error;
      return data as Issue;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("issues").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },

    async countByField(tenantId: string, field: string, key: string): Promise<number> {
      const { count, error } = await supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq(field, key);
      if (error) throw error;
      return count ?? 0;
    },

    async countForProject(tenantId: string, projectId: string): Promise<{ total: number; done: number }> {
      const [totalRes, doneRes] = await Promise.all([
        supabase.from("issues").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("project_id", projectId),
        supabase.from("issues").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("project_id", projectId).eq("status", "done"),
      ]);
      if (totalRes.error) throw totalRes.error;
      if (doneRes.error) throw doneRes.error;
      return { total: totalRes.count ?? 0, done: doneRes.count ?? 0 };
    },

    async countUnassigned(tenantId: string): Promise<number> {
      const { count, error } = await supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("assignee_id", null)
        .neq("status", "done");
      if (error) throw error;
      return count ?? 0;
    },
  };
}
