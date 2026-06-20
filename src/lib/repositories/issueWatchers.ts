import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueWatcher = {
  issueId: string;
  userId: string;
  tenantId: string;
  createdAt: string;
};

export function issueWatchersRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, issueId: string): Promise<IssueWatcher[]> {
      const { data, error } = await supabase
        .from("issue_watchers")
        .select("issue_id, user_id, tenant_id, created_at")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },

    async isWatching(tenantId: string, issueId: string, userId: string): Promise<boolean> {
      const { data } = await supabase
        .from("issue_watchers")
        .select("issue_id")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    },

    async watch(tenantId: string, issueId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from("issue_watchers")
        .upsert({ tenant_id: tenantId, issue_id: issueId, user_id: userId }, { onConflict: "issue_id,user_id" });
      if (error) throw error;
    },

    async unwatch(tenantId: string, issueId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from("issue_watchers")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .eq("user_id", userId);
      if (error) throw error;
    },

    /** Add watchers in bulk — silently ignores duplicates. */
    async watchMany(tenantId: string, issueId: string, userIds: string[]): Promise<void> {
      if (userIds.length === 0) return;
      const rows = userIds.map((userId) => ({ tenant_id: tenantId, issue_id: issueId, user_id: userId }));
      const { error } = await supabase
        .from("issue_watchers")
        .upsert(rows, { onConflict: "issue_id,user_id" });
      if (error) throw error;
    },
  };
}

function mapRow(r: Record<string, unknown>): IssueWatcher {
  return {
    issueId:   r.issue_id   as string,
    userId:    r.user_id    as string,
    tenantId:  r.tenant_id  as string,
    createdAt: r.created_at as string,
  };
}
