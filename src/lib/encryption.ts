/**
 * Shared AES-256-GCM encryption helpers.
 *
 * Env var: FORGE_AI_KEY_SECRET — 64-char hex string (32 bytes).
 * All secrets (webhook signing keys, Slack tokens, etc.) share this key.
 * Generate: openssl rand -hex 32
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.FORGE_AI_KEY_SECRET ?? "";
  if (raw.length !== 64) {
    throw new Error(
      "FORGE_AI_KEY_SECRET must be a 64-char hex string (32 bytes). Generate: openssl rand -hex 32"
    );
  }
  return Buffer.from(raw, "hex");
}

export function encryptSecret(plaintext: string): { enc: string; nonce: string; tag: string } {
  const key = getKey();
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

export function decryptSecret(enc: string, nonce: string, tag: string): string {
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
