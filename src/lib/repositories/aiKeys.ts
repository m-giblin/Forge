import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
export type { AIProvider, SavedKeyInfo } from "@/lib/ai/providers";
export { AI_PROVIDERS } from "@/lib/ai/providers";
import type { AIProvider, SavedKeyInfo } from "@/lib/ai/providers";

// ---------------------------------------------------------------------------
// Encryption helpers — AES-256-GCM
// ---------------------------------------------------------------------------

function getEncKey(): Buffer {
  const raw = process.env.FORGE_AI_KEY_SECRET ?? "";
  if (raw.length !== 64) {
    throw new Error(
      "FORGE_AI_KEY_SECRET must be a 64-char hex string (32 bytes). Generate: openssl rand -hex 32"
    );
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
    /** Returns saved (active) key metadata — never decrypts. */
    async listSavedKeys(tenantId: string): Promise<SavedKeyInfo[]> {
      const { data } = await svc
        .from("tenant_ai_keys")
        .select("provider, key_hint, is_selected")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });
      return ((data ?? []) as { provider: AIProvider; key_hint: string | null; is_selected: boolean }[]).map(
        (r) => ({ provider: r.provider, keyHint: r.key_hint, isSelected: r.is_selected })
      );
    },

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

    /**
     * Decrypts and returns the currently selected BYO key.
     * Returns null if no BYO key is selected (fall back to platform default).
     * The plaintext key must never be logged or included in any API response.
     */
    async getSelectedKey(
      tenantId: string
    ): Promise<{ provider: AIProvider; apiKey: string } | null> {
      const { data } = await svc
        .from("tenant_ai_keys")
        .select("provider, key_enc, key_nonce, key_tag")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("is_selected", true)
        .maybeSingle();
      if (!data) return null;
      const apiKey = decrypt(
        data.key_enc as string,
        data.key_nonce as string,
        data.key_tag as string
      );
      return { provider: data.provider as AIProvider, apiKey };
    },

    /**
     * Encrypts and upserts an API key. The saved key is auto-selected
     * (replaces any previous selection).
     */
    async setKey(
      tenantId: string,
      provider: AIProvider,
      apiKey: string,
      createdBy: string
    ): Promise<void> {
      const { enc, nonce, tag } = encrypt(apiKey);
      const keyHint = apiKey.length >= 4 ? `****${apiKey.slice(-4)}` : "****";

      // Deselect all existing keys for this tenant.
      await svc
        .from("tenant_ai_keys")
        .update({ is_selected: false })
        .eq("tenant_id", tenantId);

      const { error } = await svc.from("tenant_ai_keys").upsert(
        {
          tenant_id: tenantId,
          provider,
          key_enc: enc,
          key_nonce: nonce,
          key_tag: tag,
          key_hint: keyHint,
          is_active: true,
          is_selected: true,
          created_by: createdBy,
        },
        { onConflict: "tenant_id,provider" }
      );
      if (error) throw error;
    },

    /** Switches which saved key is active (key must already exist). */
    async selectProvider(tenantId: string, provider: AIProvider): Promise<void> {
      await svc
        .from("tenant_ai_keys")
        .update({ is_selected: false })
        .eq("tenant_id", tenantId);
      const { error } = await svc
        .from("tenant_ai_keys")
        .update({ is_selected: true })
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .eq("is_active", true);
      if (error) throw error;
    },

    /** Soft-deactivates a key (preserves audit trail). */
    async deleteKey(tenantId: string, provider: AIProvider): Promise<void> {
      const { error } = await svc
        .from("tenant_ai_keys")
        .update({ is_active: false, is_selected: false })
        .eq("tenant_id", tenantId)
        .eq("provider", provider);
      if (error) throw error;
    },
  };
}
