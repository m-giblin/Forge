import { createHmac } from "node:crypto";
import type { Scope } from "@/lib/api/scopes";

// Pure key helpers — no server-only boundary, so they're unit-testable.

/**
 * HMAC-SHA256 hex using API_KEY_HASH_SECRET as pepper.
 * Must match the key-issuance script exactly.
 * WARNING: changing this invalidates all existing API keys — re-issue after deploy.
 */
export function hashKey(raw: string): string {
  const pepper = process.env.API_KEY_HASH_SECRET;
  if (!pepper) throw new Error("API_KEY_HASH_SECRET env var is not set");
  return createHmac("sha256", pepper).update(raw).digest("hex");
}

export function hasScope(scopes: string[], required: Scope): boolean {
  return scopes.includes(required);
}

/** Extract a Bearer token from an Authorization header value. */
export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}
