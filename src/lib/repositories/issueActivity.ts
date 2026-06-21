import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueComment = {
  id: string;
  authorId: string | null;
  authorLabel: string | null;
  body: string;
  parentId: string | null;
  createdAt: string;
  commentType: "comment" | "decision";
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
      // Try to select comment_type (available after migration 0051); fall back to omitting it
      // if the column doesn't exist yet so a missing migration never breaks the issue view.
      let rows: Array<Record<string, unknown>> = [];
      const withType = await supabase
        .from("issue_comments")
        .select("id, author_id, author_label, body, parent_id, created_at, comment_type")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });
      if (withType.error) {
        // Column probably missing — retry without it
        const without = await supabase
          .from("issue_comments")
          .select("id, author_id, author_label, body, parent_id, created_at")
          .eq("tenant_id", tenantId)
          .eq("issue_id", issueId)
          .order("created_at", { ascending: true });
        if (without.error) throw without.error;
        rows = (without.data ?? []) as Array<Record<string, unknown>>;
      } else {
        rows = (withType.data ?? []) as Array<Record<string, unknown>>;
      }
      return rows.map((c) => ({
        id: c.id as string,
        authorId: (c.author_id as string | null) ?? null,
        authorLabel: (c.author_label as string | null) ?? null,
        body: c.body as string,
        parentId: (c.parent_id as string | null) ?? null,
        createdAt: c.created_at as string,
        commentType: ((c.comment_type as string | undefined) ?? "comment") as "comment" | "decision",
      }));
    },

    async addComment(input: {
      tenantId: string;
      issueId: string;
      authorId: string | null;
      authorLabel: string | null;
      body: string;
      parentId?: string | null;
      commentType?: "comment" | "decision";
    }): Promise<IssueComment> {
      // comment_type column exists after migration 0051. Include it only when needed to
      // avoid a 500 if the migration hasn't run yet (column absent → Postgres error).
      const insertRow: Record<string, unknown> = {
        tenant_id: input.tenantId,
        issue_id: input.issueId,
        author_id: input.authorId,
        author_label: input.authorLabel,
        body: input.body,
        parent_id: input.parentId ?? null,
      };
      if (input.commentType && input.commentType !== "comment") {
        insertRow.comment_type = input.commentType;
      }
      const { data, error } = await supabase
        .from("issue_comments")
        .insert(insertRow)
        .select("id, author_id, author_label, body, parent_id, created_at")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        authorId: data.author_id,
        authorLabel: data.author_label,
        body: data.body,
        parentId: data.parent_id ?? null,
        createdAt: data.created_at,
        commentType: (input.commentType ?? "comment") as "comment" | "decision",
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
