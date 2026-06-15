import type { SupabaseClient } from "@supabase/supabase-js";

export interface IdeaRow {
  id: string;
  tenant_id: string;
  think_tank_id: string;
  title: string;
  description: string | null;
  status: string;
  is_private: boolean;
  tags: string[];
  created_by: string | null;
  assigned_to: string | null;
  linked_project_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaSummary extends IdeaRow {
  creator_name: string | null;
  assignee_name: string | null;
  comment_count: number;
}

export interface ThinkTankRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ListIdeasOpts {
  thinkTankId?: string;
  status?: string;
  tag?: string;
  assignedTo?: string;
  excludeArchived?: boolean;
}

export function ideasRepo(supabase: SupabaseClient) {
  return {
    async getOrCreateDefaultThinkTank(tenantId: string, userId: string): Promise<ThinkTankRow> {
      // Try to get existing default
      const { data: existing } = await supabase
        .from("think_tanks")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existing) return existing as ThinkTankRow;

      const { data: created, error } = await supabase
        .from("think_tanks")
        .insert({ tenant_id: tenantId, name: "Think Tank", created_by: userId })
        .select()
        .single();

      if (error) throw error;
      return created as ThinkTankRow;
    },

    async list(tenantId: string, opts: ListIdeasOpts = {}): Promise<IdeaSummary[]> {
      let q = supabase
        .from("ideas")
        .select(`
          *,
          creator:users!ideas_created_by_fkey(id, name),
          assignee:users!ideas_assigned_to_fkey(id, name),
          idea_comments(count)
        `)
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (opts.thinkTankId) q = q.eq("think_tank_id", opts.thinkTankId);
      if (opts.status) q = q.eq("status", opts.status);
      if (opts.tag) q = q.contains("tags", [opts.tag]);
      if (opts.assignedTo) q = q.eq("assigned_to", opts.assignedTo);
      if (opts.excludeArchived) q = q.neq("status", "archived");

      const { data, error } = await q;
      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        ...(row as unknown as IdeaRow),
        creator_name: (row.creator as { name?: string } | null)?.name ?? null,
        assignee_name: (row.assignee as { name?: string } | null)?.name ?? null,
        comment_count:
          Array.isArray(row.idea_comments) && row.idea_comments.length > 0
            ? (row.idea_comments[0] as { count?: number }).count ?? 0
            : 0,
      }));
    },

    async getById(tenantId: string, id: string): Promise<IdeaRow | null> {
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as IdeaRow) ?? null;
    },

    async create(input: {
      tenant_id: string;
      think_tank_id: string;
      title: string;
      description?: string | null;
      tags?: string[];
      is_private?: boolean;
      assigned_to?: string | null;
      created_by: string;
    }): Promise<IdeaRow> {
      const { data, error } = await supabase
        .from("ideas")
        .insert({ status: "new", ...input })
        .select()
        .single();
      if (error) throw error;
      return data as IdeaRow;
    },

    async update(
      tenantId: string,
      id: string,
      patch: Partial<Pick<IdeaRow, "title" | "description" | "status" | "is_private" | "tags" | "assigned_to" | "linked_project_id" | "converted_at">>
    ): Promise<IdeaRow> {
      const { data, error } = await supabase
        .from("ideas")
        .update(patch)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as IdeaRow;
    },

    async getAllTags(tenantId: string): Promise<string[]> {
      const { data } = await supabase
        .from("ideas")
        .select("tags")
        .eq("tenant_id", tenantId);
      const all = (data ?? []).flatMap((r: { tags?: string[] }) => r.tags ?? []);
      return [...new Set(all)].sort();
    },
  };
}
