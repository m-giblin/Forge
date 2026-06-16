import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AIProvider = "openai" | "anthropic" | "xai" | "gemini";

export const AI_PROVIDERS: AIProvider[] = ["openai", "anthropic", "xai", "gemini"];

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM
// ---------------------------------------------------------------------------

function getEncKey(): Buffer {
  const raw = process.env.FORGE_AI_KEY_SECRET ?? "";
  if (raw.length !== 64) {
    throw new Error("FORGE_AI_KEY_SECRET must be a 64-char hex string (32 bytes). Generate: openssl rand -hex 32");
  }
  return Buffer.from(raw, "hex");
}

function encrypt(plaintext: string): { enc: string; nonce: string; tag: string } {
  const key = getEncKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: enc.toString("base64"),
    nonce: nonce.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decrypt(enc: string, nonce: string, tag: string): string {
  const key = getEncKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(nonce, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(enc, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

// ---------------------------------------------------------------------------
// Repository — always use service-role client (bypasses RLS by design)
// ---------------------------------------------------------------------------

export function tenantAiKeysRepo(svc: SupabaseClient) {
  return {
    /** Returns true if the tenant has an active key for this provider. */
    async hasKey(tenantId: string, provider: AIProvider): Promise<boolean> {
      const { data } = await svc
        .from("tenant_ai_keys")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },

    /** Returns list of providers for which the tenant has an active key. */
    async listProviders(tenantId: string): Promise<AIProvider[]> {
      const { data } = await svc
        .from("tenant_ai_keys")
        .select("provider")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      return ((data ?? []) as { provider: AIProvider }[]).map((r) => r.provider);
    },

    /** Encrypts and saves (upserts) an API key for this provider. */
    async setKey(
      tenantId: string,
      provider: AIProvider,
      apiKey: string,
      createdBy: string
    ): Promise<void> {
      const { enc, nonce, tag } = encrypt(apiKey);
      const { error } = await svc.from("tenant_ai_keys").upsert(
        {
          tenant_id: tenantId,
          provider,
          key_enc: enc,
          key_nonce: nonce,
          key_tag: tag,
          is_active: true,
          created_by: createdBy,
        },
        { onConflict: "tenant_id,provider" }
      );
      if (error) throw error;
    },

    /**
     * Decrypts and returns the active API key for this provider.
     * Returns null if none is set. The plaintext key must never be logged
     * or included in any API response.
     */
    async getKey(tenantId: string, provider: AIProvider): Promise<string | null> {
      const { data } = await svc
        .from("tenant_ai_keys")
        .select("key_enc, key_nonce, key_tag")
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) return null;
      return decrypt(
        data.key_enc as string,
        data.key_nonce as string,
        data.key_tag as string
      );
    },

    /** Soft-deactivates a key (keeps audit trail). */
    async deleteKey(tenantId: string, provider: AIProvider): Promise<void> {
      const { error } = await svc
        .from("tenant_ai_keys")
        .update({ is_active: false })
        .eq("tenant_id", tenantId)
        .eq("provider", provider);
      if (error) throw error;
    },
  };
}
