import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type { AIProvider, SavedKeyInfo } from "@/lib/ai/providers";
export { AI_PROVIDERS } from "@/lib/ai/providers";
import type { AIProvider, SavedKeyInfo } from "@/lib/ai/providers";
import { encryptSecret, decryptSecret } from "@/lib/encryption";

// Wrappers that bind tenantId to the per-tenant key derivation
const encrypt = (plaintext: string, tenantId: string) => encryptSecret(plaintext, tenantId);
const decrypt = (enc: string, nonce: string, tag: string, tenantId: string) =>
  decryptSecret(enc, nonce, tag, tenantId);

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
        data.key_tag as string,
        tenantId
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
      const { enc, nonce, tag } = encrypt(apiKey, tenantId);
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

    /** Deselects all keys for a tenant (fall back to platform default). */
    async deselectAll(tenantId: string): Promise<void> {
      const { error } = await svc
        .from("tenant_ai_keys")
        .update({ is_selected: false })
        .eq("tenant_id", tenantId);
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
