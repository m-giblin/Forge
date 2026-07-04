import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "@/lib/encryption";

export type WebhookEndpoint = {
  id: string;
  tenantId: string;
  url: string;
  secret: string; // plaintext — only decrypted via getSecret(), never returned by list()
  events: string[];
  enabled: boolean;
  createdAt: string;
};

// Metadata-only — no secret. Safe to return from list endpoints.
export type WebhookEndpointMeta = Omit<WebhookEndpoint, "secret">;

export const WEBHOOK_EVENTS = [
  "issue.created",
  "issue.updated",
  "issue.deleted",
  "comment.created",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const COLS = "id, tenant_id, url, secret_enc, secret_nonce, secret_tag, events, enabled, created_at";
const META_COLS = "id, tenant_id, url, events, enabled, created_at";

function mapRow(r: Record<string, unknown>): WebhookEndpoint {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    url: r.url as string,
    secret: decryptSecret(
      r.secret_enc as string,
      r.secret_nonce as string,
      r.secret_tag as string,
      r.tenant_id as string
    ),
    events: (r.events as string[]) ?? [],
    enabled: r.enabled as boolean,
    createdAt: r.created_at as string,
  };
}

function mapMeta(r: Record<string, unknown>): WebhookEndpointMeta {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    url: r.url as string,
    events: (r.events as string[]) ?? [],
    enabled: r.enabled as boolean,
    createdAt: r.created_at as string,
  };
}

export function webhooksRepo(supabase: SupabaseClient) {
  return {
    // Returns metadata only — no secrets. Use this for all list/display endpoints.
    async listMetadata(tenantId: string): Promise<WebhookEndpointMeta[]> {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select(META_COLS)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => mapMeta(r as Record<string, unknown>));
    },

    // Decrypt and return the secret for a single webhook. Requires explicit intent.
    async getSecret(tenantId: string, id: string): Promise<string | null> {
      const { data } = await supabase
        .from("webhook_endpoints")
        .select("secret_enc, secret_nonce, secret_tag, tenant_id")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      return decryptSecret(
        data.secret_enc as string,
        data.secret_nonce as string,
        data.secret_tag as string,
        data.tenant_id as string
      );
    },

    // Internal use only — for outbound webhook delivery (needs the secret to sign).
    async list(tenantId: string): Promise<WebhookEndpoint[]> {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async listEnabledForEvent(tenantId: string, event: WebhookEvent): Promise<WebhookEndpoint[]> {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("enabled", true)
        .contains("events", [event]);
      if (error) throw error;
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },

    async create(tenantId: string, input: { url: string; secret: string; events: string[] }): Promise<WebhookEndpoint> {
      const { enc, nonce, tag } = encryptSecret(input.secret, tenantId);
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .insert({
          tenant_id: tenantId,
          url: input.url,
          secret_enc: enc,
          secret_nonce: nonce,
          secret_tag: tag,
          events: input.events,
        })
        .select(COLS)
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
