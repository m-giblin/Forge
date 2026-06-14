import { createHash } from "node:crypto";
import type { Scope } from "@/lib/api/scopes";

// Pure key helpers — no server-only boundary, so they're unit-testable.

/** SHA-256 hex. Must match the key-issuance script exactly. */
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
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
