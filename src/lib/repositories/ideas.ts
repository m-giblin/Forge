import type { SupabaseClient } from "@supabase/supabase-js";

export interface IdeaDecision {
  id: string;
  ideaId: string;
  title: string;
  body: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  createdAt: string;
}

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

export interface IdeaCommentAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
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
  attachments: IdeaCommentAttachment[];
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
  is_anonymous: boolean;
  linked_okr_id: string | null;
  tags: string[];
  created_by: string | null;
  assigned_to: string | null;
  linked_project_id: string | null;
  converted_at: string | null;
  review_by: string | null;
  impact_score: number | null;
  effort_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaSummary extends IdeaRow {
  creator_name: string | null;
  assignee_name: string | null;
  comment_count: number;
  vote_count: number;
  user_has_voted: boolean;
  ai_turn_count: number;
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

    async list(tenantId: string, opts: ListIdeasOpts & { userId?: string } = {}): Promise<IdeaSummary[]> {
      let q = supabase
        .from("ideas")
        .select(`
          *,
          creator:users!ideas_created_by_fkey(id, name),
          assignee:users!ideas_assigned_to_fkey(id, name),
          idea_comments(count),
          idea_votes(count),
          idea_ai_turns(count)
        `)
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (opts.thinkTankId) q = q.eq("think_tank_id", opts.thinkTankId);
      if (opts.status) q = q.eq("status", opts.status);
      if (opts.tag) q = q.contains("tags", [opts.tag]);
      if (opts.assignedTo) q = q.eq("assigned_to", opts.assignedTo);
      if (opts.excludeArchived) q = q.neq("status", "archived");

      const [{ data, error }, votedIds] = await Promise.all([
        q,
        opts.userId
          ? ideaVotesRepo(supabase).getVotedIdeaIds(tenantId, opts.userId)
          : Promise.resolve(new Set<string>()),
      ]);
      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        ...(row as unknown as IdeaRow),
        creator_name: (row.creator as { name?: string } | null)?.name ?? null,
        assignee_name: (row.assignee as { name?: string } | null)?.name ?? null,
        comment_count:
          Array.isArray(row.idea_comments) && row.idea_comments.length > 0
            ? (row.idea_comments[0] as { count?: number }).count ?? 0
            : 0,
        vote_count:
          Array.isArray(row.idea_votes) && row.idea_votes.length > 0
            ? (row.idea_votes[0] as { count?: number }).count ?? 0
            : 0,
        ai_turn_count:
          Array.isArray(row.idea_ai_turns) && row.idea_ai_turns.length > 0
            ? (row.idea_ai_turns[0] as { count?: number }).count ?? 0
            : 0,
        user_has_voted: votedIds.has((row as unknown as IdeaRow).id),
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
      is_anonymous?: boolean;
      linked_okr_id?: string | null;
      assigned_to?: string | null;
      review_by?: string | null;
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
      patch: Partial<Pick<IdeaRow, "title" | "description" | "status" | "is_private" | "is_anonymous" | "linked_okr_id" | "tags" | "assigned_to" | "linked_project_id" | "converted_at" | "review_by" | "impact_score" | "effort_score">>
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
          author:users!idea_comments_author_id_fkey(id, name),
          idea_comment_attachments(id, filename, content_type, size_bytes, storage_path)
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
        attachments: ((row.idea_comment_attachments as Record<string, unknown>[] | null) ?? []).map((a) => ({
          id: a.id as string,
          filename: a.filename as string,
          contentType: a.content_type as string,
          sizeBytes: a.size_bytes as number,
          storagePath: a.storage_path as string,
        })),
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
        attachments: [],
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
      tokensInput?: number | null;
      tokensOutput?: number | null;
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
        tokens_input: input.tokensInput ?? null,
        tokens_output: input.tokensOutput ?? null,
      });
      if (error) throw error;
    },

    async getLatest(tenantId: string, ideaId: string): Promise<IdeaAiTurn | null> {
      const turns = await this.listRecent(tenantId, ideaId, 1);
      return turns[0] ?? null;
    },

    async listRecent(tenantId: string, ideaId: string, limit = 5): Promise<IdeaAiTurn[]> {
      const { data, error } = await supabase
        .from("idea_ai_turns")
        .select("id, idea_id, user_id, pills, user_input, ai_response, provider, created_at")
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).reverse().map((row) => ({
        id: row.id,
        ideaId: row.idea_id,
        userId: row.user_id,
        pills: row.pills,
        userInput: row.user_input,
        aiResponse: row.ai_response,
        provider: row.provider,
        createdAt: row.created_at,
      }));
    },

    async getUsageSummary(tenantId: string, sinceIso: string): Promise<{
      totalCalls: number;
      totalTokensInput: number;
      totalTokensOutput: number;
      byProvider: Array<{ provider: string; calls: number; tokensInput: number; tokensOutput: number }>;
      byUser: Array<{ userId: string | null; calls: number; tokensInput: number; tokensOutput: number }>;
    }> {
      const { data, error } = await supabase
        .from("idea_ai_turns")
        .select("provider, user_id, tokens_input, tokens_output")
        .eq("tenant_id", tenantId)
        .gte("created_at", sinceIso);
      if (error) throw error;

      const rows = data ?? [];
      const providerMap = new Map<string, { calls: number; tokensInput: number; tokensOutput: number }>();
      const userMap = new Map<string | null, { calls: number; tokensInput: number; tokensOutput: number }>();
      let totalCalls = 0, totalTokensInput = 0, totalTokensOutput = 0;

      for (const row of rows) {
        const tin = row.tokens_input ?? 0;
        const tout = row.tokens_output ?? 0;
        const provider = row.provider ?? "unknown";
        const userId = row.user_id as string | null;

        totalCalls++;
        totalTokensInput += tin;
        totalTokensOutput += tout;

        const p = providerMap.get(provider) ?? { calls: 0, tokensInput: 0, tokensOutput: 0 };
        p.calls++; p.tokensInput += tin; p.tokensOutput += tout;
        providerMap.set(provider, p);

        const u = userMap.get(userId) ?? { calls: 0, tokensInput: 0, tokensOutput: 0 };
        u.calls++; u.tokensInput += tin; u.tokensOutput += tout;
        userMap.set(userId, u);
      }

      return {
        totalCalls,
        totalTokensInput,
        totalTokensOutput,
        byProvider: Array.from(providerMap.entries())
          .map(([provider, s]) => ({ provider, ...s }))
          .sort((a, b) => b.calls - a.calls),
        byUser: Array.from(userMap.entries())
          .map(([userId, s]) => ({ userId, ...s }))
          .sort((a, b) => b.calls - a.calls),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Votes repo
// ---------------------------------------------------------------------------

export function ideaVotesRepo(supabase: SupabaseClient) {
  return {
    /** Returns the set of idea IDs the given user has voted on in this tenant. */
    async getVotedIdeaIds(tenantId: string, userId: string): Promise<Set<string>> {
      const { data } = await supabase
        .from("idea_votes")
        .select("idea_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);
      return new Set((data ?? []).map((r: { idea_id: string }) => r.idea_id));
    },

    /** Toggles the current user's vote. Returns whether the user is now voted. */
    async toggle(tenantId: string, ideaId: string, userId: string): Promise<{ voted: boolean }> {
      const { data: existing } = await supabase
        .from("idea_votes")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase.from("idea_votes").delete()
          .eq("id", existing.id)
          .eq("user_id", userId);
        return { voted: false };
      }

      await supabase.from("idea_votes").insert({
        tenant_id: tenantId,
        idea_id: ideaId,
        user_id: userId,
      });
      return { voted: true };
    },
  };
}

// ---------------------------------------------------------------------------
// Custom pills repo
// ---------------------------------------------------------------------------

export interface CustomPillRow {
  id: string;
  tenantId: string;
  label: string;
  instruction: string;
  sortOrder: number;
  createdAt: string;
}

export function thinkTankPillsRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<CustomPillRow[]> {
      const { data, error } = await supabase
        .from("think_tank_pills")
        .select("id, tenant_id, label, instruction, sort_order, created_at")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        tenantId: r.tenant_id as string,
        label: r.label as string,
        instruction: r.instruction as string,
        sortOrder: r.sort_order as number,
        createdAt: r.created_at as string,
      }));
    },

    async create(input: { tenantId: string; label: string; instruction: string; sortOrder?: number }): Promise<CustomPillRow> {
      const { data, error } = await supabase
        .from("think_tank_pills")
        .insert({
          tenant_id: input.tenantId,
          label: input.label,
          instruction: input.instruction,
          sort_order: input.sortOrder ?? 0,
        })
        .select("id, tenant_id, label, instruction, sort_order, created_at")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        tenantId: data.tenant_id,
        label: data.label,
        instruction: data.instruction,
        sortOrder: data.sort_order,
        createdAt: data.created_at,
      };
    },

    async update(tenantId: string, id: string, patch: { label?: string; instruction?: string; sortOrder?: number }): Promise<void> {
      const { error } = await supabase
        .from("think_tank_pills")
        .update({
          ...(patch.label !== undefined && { label: patch.label }),
          ...(patch.instruction !== undefined && { instruction: patch.instruction }),
          ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
        })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("think_tank_pills")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Decisions repo
// ---------------------------------------------------------------------------

export function ideaDecisionsRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, ideaId: string): Promise<IdeaDecision[]> {
      const { data, error } = await supabase
        .from("idea_decisions")
        .select("id, idea_id, title, body, decided_by, created_at, users:decided_by(name, email)")
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const u = row.users as { name?: string | null; email?: string | null } | null;
        return {
          id: row.id,
          ideaId: row.idea_id,
          title: row.title,
          body: row.body,
          decidedBy: row.decided_by,
          decidedByName: u?.name ?? u?.email ?? null,
          createdAt: row.created_at,
        };
      });
    },

    async listForIdeas(tenantId: string, ideaIds: string[]): Promise<IdeaDecision[]> {
      if (ideaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("idea_decisions")
        .select("id, idea_id, title, body, decided_by, created_at, users:decided_by(name, email)")
        .eq("tenant_id", tenantId)
        .in("idea_id", ideaIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const u = row.users as { name?: string | null; email?: string | null } | null;
        return {
          id: row.id,
          ideaId: row.idea_id,
          title: row.title,
          body: row.body,
          decidedBy: row.decided_by,
          decidedByName: u?.name ?? u?.email ?? null,
          createdAt: row.created_at,
        };
      });
    },

    async add(input: {
      tenantId: string;
      ideaId: string;
      title: string;
      body: string | null;
      decidedBy: string;
    }): Promise<string> {
      const { data, error } = await supabase
        .from("idea_decisions")
        .insert({
          tenant_id: input.tenantId,
          idea_id: input.ideaId,
          title: input.title.trim(),
          body: input.body?.trim() || null,
          decided_by: input.decidedBy,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },

    async softDelete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("idea_decisions")
        .update({ is_deleted: true })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Sign-offs repo (Design C — cross-functional readiness)
// ---------------------------------------------------------------------------

export const SIGNOFF_ROLES = ["design", "product", "engineering"] as const;
export type SignoffRole = (typeof SIGNOFF_ROLES)[number];

export interface IdeaSignoff {
  id: string;
  ideaId: string;
  role: SignoffRole;
  approvedBy: string | null;
  approvedByName: string | null;
  note: string | null;
  createdAt: string;
}

export function ideaSignoffsRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, ideaId: string): Promise<IdeaSignoff[]> {
      const { data, error } = await supabase
        .from("idea_signoffs")
        .select("id, idea_id, role, approved_by, note, created_at, users:approved_by(name, email)")
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const u = (Array.isArray(row.users) ? row.users[0] : row.users) as
          | { name?: string | null; email?: string | null }
          | null;
        return {
          id: row.id,
          ideaId: row.idea_id,
          role: row.role as SignoffRole,
          approvedBy: row.approved_by,
          approvedByName: u?.name ?? u?.email ?? null,
          note: row.note,
          createdAt: row.created_at,
        };
      });
    },

    /** Record (or move) a role's approval. Idempotent on (idea_id, role). */
    async approve(input: {
      tenantId: string;
      ideaId: string;
      role: SignoffRole;
      approvedBy: string;
      note: string | null;
    }): Promise<void> {
      const { error } = await supabase
        .from("idea_signoffs")
        .upsert(
          {
            tenant_id: input.tenantId,
            idea_id: input.ideaId,
            role: input.role,
            approved_by: input.approvedBy,
            note: input.note?.trim() || null,
          },
          { onConflict: "idea_id,role" }
        );
      if (error) throw error;
    },

    async revoke(tenantId: string, ideaId: string, role: SignoffRole): Promise<void> {
      const { error } = await supabase
        .from("idea_signoffs")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("idea_id", ideaId)
        .eq("role", role);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Tenant idea templates repo
// ---------------------------------------------------------------------------

export interface TenantIdeaTemplate {
  id: string;
  label: string;
  description: string;
  suggestedPillIds: string[];
  sortOrder: number;
  createdAt: string;
}

export function tenantIdeaTemplatesRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<TenantIdeaTemplate[]> {
      const { data, error } = await supabase
        .from("tenant_idea_templates")
        .select("id, label, description, suggested_pill_ids, sort_order, created_at")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description,
        suggestedPillIds: row.suggested_pill_ids ?? [],
        sortOrder: row.sort_order,
        createdAt: row.created_at,
      }));
    },

    async create(tenantId: string, userId: string, input: { label: string; description: string; suggestedPillIds: string[] }): Promise<string> {
      const { data, error } = await supabase
        .from("tenant_idea_templates")
        .insert({
          tenant_id: tenantId,
          label: input.label.trim(),
          description: input.description.trim(),
          suggested_pill_ids: input.suggestedPillIds,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },

    async update(tenantId: string, id: string, input: { label: string; description: string; suggestedPillIds: string[] }): Promise<void> {
      const { error } = await supabase
        .from("tenant_idea_templates")
        .update({
          label: input.label.trim(),
          description: input.description.trim(),
          suggested_pill_ids: input.suggestedPillIds,
        })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async remove(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("tenant_idea_templates")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },
  };
}
