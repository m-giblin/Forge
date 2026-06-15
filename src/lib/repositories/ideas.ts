import type { SupabaseClient } from "@supabase/supabase-js";

export interface IdeaAiTurn {
  id: string;
  ideaId: string;
  userId: string | null;
  pills: string[];
  userInput: string | null;
  aiResponse: string;
  provider: string;
  createdAt: string;
}

export interface IdeaComment {
  id: string;
  ideaId: string;
  body: string;
  isDeleted: boolean;
  authorId: string | null;
  authorName: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaRow {
  id: string;
  tenant_id: string;
  think_tank_id: string;
  number: number | null;
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

export function ideaCommentsRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, ideaId: string): Promise<IdeaComment[]> {
      const { data, error } = await supabase
        .from("idea_comments")
        .select(`
          id, idea_id, body, is_deleted, author_id, parent_id, created_at, updated_at,
          author:users!idea_comments_author_id_fkey(id, name)
        `)
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        ideaId: row.idea_id as string,
        body: row.body as string,
        isDeleted: row.is_deleted as boolean,
        authorId: row.author_id as string | null,
        authorName: (row.author as { name?: string } | null)?.name ?? null,
        parentId: row.parent_id as string | null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));
    },

    async add(input: {
      tenantId: string;
      ideaId: string;
      authorId: string;
      body: string;
      parentId?: string | null;
    }): Promise<IdeaComment> {
      const { data, error } = await supabase
        .from("idea_comments")
        .insert({
          tenant_id: input.tenantId,
          idea_id: input.ideaId,
          author_id: input.authorId,
          body: input.body,
          parent_id: input.parentId ?? null,
        })
        .select("id, idea_id, body, is_deleted, author_id, parent_id, created_at, updated_at")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        ideaId: data.idea_id,
        body: data.body,
        isDeleted: data.is_deleted,
        authorId: data.author_id,
        authorName: null,
        parentId: data.parent_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },

    async edit(tenantId: string, id: string, body: string): Promise<void> {
      const { error } = await supabase
        .from("idea_comments")
        .update({ body })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async softDelete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("idea_comments")
        .update({ is_deleted: true })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async getById(
      tenantId: string,
      id: string
    ): Promise<{ ideaId: string; authorId: string | null; createdAt: string; isDeleted: boolean } | null> {
      const { data, error } = await supabase
        .from("idea_comments")
        .select("id, idea_id, author_id, created_at, is_deleted")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ideaId: data.idea_id,
        authorId: data.author_id,
        createdAt: data.created_at,
        isDeleted: data.is_deleted,
      };
    },
  };
}

export function ideaAiTurnsRepo(supabase: SupabaseClient) {
  return {
    async add(input: {
      tenantId: string;
      ideaId: string;
      userId: string;
      pills: string[];
      userInput?: string | null;
      promptSent: string;
      aiResponse: string;
      provider: string;
    }): Promise<void> {
      const { error } = await supabase.from("idea_ai_turns").insert({
        tenant_id: input.tenantId,
        idea_id: input.ideaId,
        user_id: input.userId,
        pills: input.pills,
        user_input: input.userInput ?? null,
        prompt_sent: input.promptSent,
        ai_response: input.aiResponse,
        provider: input.provider,
      });
      if (error) throw error;
    },

    async getLatest(tenantId: string, ideaId: string): Promise<IdeaAiTurn | null> {
      const { data, error } = await supabase
        .from("idea_ai_turns")
        .select("id, idea_id, user_id, pills, user_input, ai_response, provider, created_at")
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        ideaId: data.idea_id,
        userId: data.user_id,
        pills: data.pills,
        userInput: data.user_input,
        aiResponse: data.ai_response,
        provider: data.provider,
        createdAt: data.created_at,
      };
    },
  };
}
