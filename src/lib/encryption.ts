/**
 * AES-256-GCM encryption helpers with per-tenant key derivation.
 *
 * Master key env var: FORGE_AI_KEY_SECRET — 64-char hex string (32 bytes).
 * Generate: openssl rand -hex 32
 *
 * Per-tenant sub-keys are derived via HKDF(SHA-256) using the tenantId as the
 * "info" parameter. A compromise of one tenant's derived key does NOT expose
 * secrets belonging to other tenants. Rotation can be done per-tenant.
 *
 * BREAKING: this replaces the shared master key. Any Slack tokens / webhook keys
 * stored before this change must be re-entered by tenants after deploy.
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";

function getMasterKey(): Buffer {
  const raw = process.env.FORGE_AI_KEY_SECRET ?? "";
  if (raw.length !== 64) {
    throw new Error(
      "FORGE_AI_KEY_SECRET must be a 64-char hex string (32 bytes). Generate: openssl rand -hex 32"
    );
  }
  return Buffer.from(raw, "hex");
}

function deriveTenantKey(tenantId: string): Buffer {
  const master = getMasterKey();
  return Buffer.from(
    hkdfSync("sha256", master, tenantId, "forge-tenant-secret-v1", 32)
  );
}

export function encryptSecret(
  plaintext: string,
  tenantId: string
): { enc: string; nonce: string; tag: string } {
  const key = deriveTenantKey(tenantId);
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

export function decryptSecret(
  enc: string,
  nonce: string,
  tag: string,
  tenantId: string
): string {
  const key = deriveTenantKey(tenantId);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
