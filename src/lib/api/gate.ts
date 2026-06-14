import { authenticateApiKey, hasScope, type ApiAuthResult } from "@/lib/api/auth";
import { apiError } from "@/lib/api/response";
import { getRateLimiter } from "@/lib/providers/rate-limiter";
import type { Scope } from "@/lib/api/scopes";
import type { NextResponse } from "next/server";

// Per-key and per-tenant fixed-window limits (dev values; tune for prod).
const KEY_LIMIT = 100;
const TENANT_LIMIT = 300;
const WINDOW_MS = 60_000;
// Throttle FAILED auth attempts per IP to blunt API-key brute-forcing (review #2).
const AUTH_FAIL_LIMIT = 10;

type Authed = Extract<ApiAuthResult, { ok: true }>;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Shared API gate for every v1 endpoint: authenticate the key, enforce the
 * required scope, and rate-limit per key and per tenant. Returns either an
 * error response to short-circuit with, or the authenticated context.
 */
export async function enforce(
  req: Request,
  scope: Scope
): Promise<{ error: NextResponse } | { error?: undefined; auth: Authed }> {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    // Count this failure against the caller's IP; block after too many/min.
    const rl = getRateLimiter();
    const fail = await rl.check(`authfail:${clientIp(req)}`, AUTH_FAIL_LIMIT, WINDOW_MS);
    if (!fail.allowed) {
      return { error: apiError("rate_limited", "Too many failed auth attempts. Try again later.") };
    }
    return { error: apiError(auth.code, auth.message) };
  }
  if (!hasScope(auth.scopes, scope)) {
    return { error: apiError("forbidden", `This key is missing the "${scope}" scope.`) };
  }
  const rl = getRateLimiter();
  const k = await rl.check(`key:${auth.keyId}`, KEY_LIMIT, WINDOW_MS);
  const t = await rl.check(`tenant:${auth.tenantId}`, TENANT_LIMIT, WINDOW_MS);
  if (!k.allowed || !t.allowed) {
    return { error: apiError("rate_limited", "Rate limit exceeded. Slow down.") };
  }
  return { auth };
}
