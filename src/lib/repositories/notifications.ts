import type { SupabaseClient } from "@supabase/supabase-js";

export type Notification = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  issueId: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
};

export function notificationsRepo(supabase: SupabaseClient) {
  return {
    async create(input: {
      tenantId: string;
      userId: string;
      type: string;
      title: string;
      body?: string | null;
      issueId?: string | null;
      linkPath?: string | null;
    }): Promise<Notification> {
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          tenant_id: input.tenantId,
          user_id: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          issue_id: input.issueId ?? null,
          link_path: input.linkPath ?? null,
        })
        .select("id, tenant_id, user_id, type, title, body, issue_id, link_path, read_at, created_at")
        .single();
      if (error) throw error;
      return mapRow(data);
    },

    async list(
      userId: string,
      opts: { limit?: number; includeRead?: boolean } = {}
    ): Promise<Notification[]> {
      let q = supabase
        .from("notifications")
        .select("id, tenant_id, user_id, type, title, body, issue_id, link_path, read_at, created_at")
        .eq("user_id", userId);
      // Filters must come before transform methods (order/limit).
      if (!opts.includeRead) q = q.is("read_at", null);
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(opts.limit ?? 30);
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },

    async unreadCount(userId: string): Promise<number> {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },

    async markAllRead(userId: string): Promise<void> {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    },

    async markRead(userId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", id);
      if (error) throw error;
    },
  };
}

function mapRow(r: Record<string, unknown>): Notification {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    userId: r.user_id as string,
    type: r.type as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    issueId: (r.issue_id as string | null) ?? null,
    linkPath: (r.link_path as string | null) ?? null,
    readAt: (r.read_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}
