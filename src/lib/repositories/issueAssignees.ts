import type { SupabaseClient } from "@supabase/supabase-js";

// The FULL set of assignees for an issue. issues.assignee_id remains the
// canonical PRIMARY (DRI); this table holds every assignee, primary included.
// See migration 0087_issue_assignees.sql.

export type IssueAssignee = {
  id: string;
  issueId: string;
  userId: string;
  addedAt: string;
  // Joined user fields (best-effort; null if the join is skipped).
  name: string | null;
  email: string | null;
};

type Row = {
  id: string;
  issue_id: string;
  user_id: string;
  added_at: string;
  users?: { name: string | null; email: string | null } | null;
};

function mapRow(r: Row): IssueAssignee {
  return {
    id: r.id,
    issueId: r.issue_id,
    userId: r.user_id,
    addedAt: r.added_at,
    name: r.users?.name ?? null,
    email: r.users?.email ?? null,
  };
}

export function issueAssigneesRepo(supabase: SupabaseClient) {
  return {
    /** Full assignee set for one issue, with user name/email joined. */
    async listForIssue(tenantId: string, issueId: string): Promise<IssueAssignee[]> {
      const { data, error } = await supabase
        .from("issue_assignees")
        .select("id, issue_id, user_id, added_at, users:user_id(name, email)")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("added_at");
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as unknown as Row));
    },

    /** Assignee user_ids for a batch of issues → Map<issueId, userId[]>. */
    async mapForIssues(
      tenantId: string,
      issueIds: string[]
    ): Promise<Map<string, string[]>> {
      const out = new Map<string, string[]>();
      if (issueIds.length === 0) return out;
      const { data, error } = await supabase
        .from("issue_assignees")
        .select("issue_id, user_id")
        .eq("tenant_id", tenantId)
        .in("issue_id", issueIds);
      if (error) throw error;
      for (const r of data ?? []) {
        const key = r.issue_id as string;
        const arr = out.get(key) ?? [];
        arr.push(r.user_id as string);
        out.set(key, arr);
      }
      return out;
    },

    async add(tenantId: string, issueId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from("issue_assignees")
        .upsert(
          { tenant_id: tenantId, issue_id: issueId, user_id: userId },
          { onConflict: "issue_id,user_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    },

    async remove(tenantId: string, issueId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from("issue_assignees")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .eq("user_id", userId);
      if (error) throw error;
    },

    /**
     * Replace the entire set for an issue with `userIds`. Idempotent.
     * Caller is responsible for keeping issues.assignee_id (primary) consistent.
     */
    async setForIssue(
      tenantId: string,
      issueId: string,
      userIds: string[]
    ): Promise<void> {
      const desired = Array.from(new Set(userIds));
      const { data: existing, error: readErr } = await supabase
        .from("issue_assignees")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId);
      if (readErr) throw readErr;

      const have = new Set((existing ?? []).map((r) => r.user_id as string));
      const toAdd = desired.filter((u) => !have.has(u));
      const toRemove = [...have].filter((u) => !desired.includes(u));

      if (toAdd.length > 0) {
        const { error } = await supabase.from("issue_assignees").insert(
          toAdd.map((user_id) => ({ tenant_id: tenantId, issue_id: issueId, user_id }))
        );
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("issue_assignees")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("issue_id", issueId)
          .in("user_id", toRemove);
        if (error) throw error;
      }
    },
  };
}
