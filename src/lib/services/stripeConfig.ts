import "server-only";
import { getSetting, setSetting } from "@/lib/platformSettings";
import { encryptSecret, decryptSecret } from "@/lib/encryption";

// Stripe credentials are platform-wide (one Stripe account for all of Forge),
// not per-tenant, so they're stored in platform_settings rather than
// tenant_ai_keys. The secret key and webhook signing secret are the two values
// that can charge money or forge a fake payment event, so they're encrypted
// with the same AES-256-GCM helper used for tenant AI keys — with a fixed
// sentinel in place of a tenantId, since there's no tenant to derive from.
const KEY_DERIVATION_SENTINEL = "__platform_stripe__";

const KEYS = {
  secretEnc: "stripe_secret_key_enc",
  secretNonce: "stripe_secret_key_nonce",
  secretTag: "stripe_secret_key_tag",
  publishable: "stripe_publishable_key",
  webhookEnc: "stripe_webhook_secret_enc",
  webhookNonce: "stripe_webhook_secret_nonce",
  webhookTag: "stripe_webhook_secret_tag",
} as const;

export type StripeConfigStatus = {
  configured: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  publishableKey: string | null;
};

export async function getStripeConfigStatus(): Promise<StripeConfigStatus> {
  const [secretEnc, publishableKey, webhookEnc] = await Promise.all([
    getSetting(KEYS.secretEnc),
    getSetting(KEYS.publishable),
    getSetting(KEYS.webhookEnc),
  ]);
  return {
    configured: !!secretEnc,
    hasSecretKey: !!secretEnc,
    hasWebhookSecret: !!webhookEnc,
    publishableKey,
  };
}

/** Decrypts and returns the live Stripe secret key, or null if not configured. */
export async function getStripeSecretKey(): Promise<string | null> {
  const [enc, nonce, tag] = await Promise.all([
    getSetting(KEYS.secretEnc),
    getSetting(KEYS.secretNonce),
    getSetting(KEYS.secretTag),
  ]);
  if (!enc || !nonce || !tag) return null;
  return decryptSecret(enc, nonce, tag, KEY_DERIVATION_SENTINEL);
}

/** Decrypts and returns the Stripe webhook signing secret, or null if not configured. */
export async function getStripeWebhookSecret(): Promise<string | null> {
  const [enc, nonce, tag] = await Promise.all([
    getSetting(KEYS.webhookEnc),
    getSetting(KEYS.webhookNonce),
    getSetting(KEYS.webhookTag),
  ]);
  if (!enc || !nonce || !tag) return null;
  return decryptSecret(enc, nonce, tag, KEY_DERIVATION_SENTINEL);
}

/** Super-admin only — caller must verify requireSuperAdmin() before calling. */
export async function saveStripeConfig(input: {
  secretKey?: string | null;
  publishableKey?: string | null;
  webhookSecret?: string | null;
}): Promise<void> {
  if (input.secretKey) {
    const { enc, nonce, tag } = encryptSecret(input.secretKey.trim(), KEY_DERIVATION_SENTINEL);
    await Promise.all([
      setSetting(KEYS.secretEnc, enc),
      setSetting(KEYS.secretNonce, nonce),
      setSetting(KEYS.secretTag, tag),
    ]);
  }
  if (input.publishableKey !== undefined && input.publishableKey !== null) {
    await setSetting(KEYS.publishable, input.publishableKey.trim());
  }
  if (input.webhookSecret) {
    const { enc, nonce, tag } = encryptSecret(input.webhookSecret.trim(), KEY_DERIVATION_SENTINEL);
    await Promise.all([
      setSetting(KEYS.webhookEnc, enc),
      setSetting(KEYS.webhookNonce, nonce),
      setSetting(KEYS.webhookTag, tag),
    ]);
  }
}
