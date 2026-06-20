import type { SupabaseClient } from "@supabase/supabase-js";

export type WebhookEndpoint = {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
};

export const WEBHOOK_EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.deleted",
  "comment.created",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

function mapRow(r: Record<string, unknown>): WebhookEndpoint {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    url: r.url as string,
    secret: r.secret as string,
    events: (r.events as string[]) ?? [],
    enabled: r.enabled as boolean,
    createdAt: r.created_at as string,
  };
}

export function webhooksRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<WebhookEndpoint[]> {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select("id, tenant_id, url, secret, events, enabled, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async listEnabledForEvent(tenantId: string, event: WebhookEvent): Promise<WebhookEndpoint[]> {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select("id, tenant_id, url, secret, events, enabled, created_at")
        .eq("tenant_id", tenantId)
        .eq("enabled", true)
        .contains("events", [event]);
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async create(tenantId: string, input: { url: string; secret: string; events: string[] }): Promise<WebhookEndpoint> {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .insert({ tenant_id: tenantId, url: input.url, secret: input.secret, events: input.events })
        .select("id, tenant_id, url, secret, events, enabled, created_at")
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },

    async update(tenantId: string, id: string, patch: { url?: string; events?: string[]; enabled?: boolean }): Promise<void> {
      const { error } = await supabase
        .from("webhook_endpoints")
        .update(patch)
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("webhook_endpoints")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },
  };
}
