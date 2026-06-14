import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueComment = {
  id: string;
  authorId: string | null;
  authorLabel: string | null;
  body: string;
  createdAt: string;
};

export type IssueEvent = {
  id: string;
  actorUserId: string | null;
  actorLabel: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

/**
 * Append-only issue history. The tables have no UPDATE/DELETE RLS policy, so
 * once written, rows can't be edited or removed by any non-service-role caller.
 */
export function issueActivityRepo(supabase: SupabaseClient) {
  return {
    async listComments(tenantId: string, issueId: string): Promise<IssueComment[]> {
      const { data, error } = await supabase
        .from("issue_comments")
        .select("id, author_id, author_label, body, created_at")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        id: c.id,
        authorId: c.author_id,
        authorLabel: c.author_label,
        body: c.body,
        createdAt: c.created_at,
      }));
    },

    async addComment(input: {
      tenantId: string;
      issueId: string;
      authorId: string | null;
      authorLabel: string | null;
      body: string;
    }): Promise<IssueComment> {
      const { data, error } = await supabase
        .from("issue_comments")
        .insert({
          tenant_id: input.tenantId,
          issue_id: input.issueId,
          author_id: input.authorId,
          author_label: input.authorLabel,
          body: input.body,
        })
        .select("id, author_id, author_label, body, created_at")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        authorId: data.author_id,
        authorLabel: data.author_label,
        body: data.body,
        createdAt: data.created_at,
      };
    },

    async listEvents(tenantId: string, issueId: string): Promise<IssueEvent[]> {
      const { data, error } = await supabase
        .from("issue_events")
        .select("id, actor_user_id, actor_label, field, old_value, new_value, created_at")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id: e.id,
        actorUserId: e.actor_user_id,
        actorLabel: e.actor_label,
        field: e.field,
        oldValue: e.old_value,
        newValue: e.new_value,
        createdAt: e.created_at,
      }));
    },

    /** Record one or more field-change events in a single insert. */
    async addEvents(
      rows: Array<{
        tenantId: string;
        issueId: string;
        actorUserId: string;
        actorLabel: string | null;
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }>
    ): Promise<void> {
      if (rows.length === 0) return;
      const { error } = await supabase.from("issue_events").insert(
        rows.map((r) => ({
          tenant_id: r.tenantId,
          issue_id: r.issueId,
          actor_user_id: r.actorUserId,
          actor_label: r.actorLabel,
          field: r.field,
          old_value: r.oldValue,
          new_value: r.newValue,
        }))
      );
      if (error) throw error;
    },
  };
}
