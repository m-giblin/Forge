import { authenticateApiKey, hasScope, type ApiAuthResult } from "@/lib/api/auth";
import { apiError } from "@/lib/api/response";
import { getRateLimiter } from "@/lib/providers/rate-limiter";
import { isIpAllowed } from "@/lib/services/ipAllowlist";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Scope } from "@/lib/api/scopes";
import type { NextResponse } from "next/server";

// Per-key: 60 req/min. Per-tenant: 500 req/min across all keys for the workspace.
const KEY_LIMIT = 60;
const TENANT_LIMIT = 500;
const WINDOW_MS = 60_000;
// Throttle FAILED auth attempts per IP to blunt API-key brute-forcing (review #2).
const AUTH_FAIL_LIMIT = 10;

type Authed = Extract<ApiAuthResult, { ok: true }>;

function clientIp(req: Request): string {
  // x-real-ip is set by Vercel/trusted proxies and cannot be spoofed by clients.
  // x-forwarded-for is client-controllable (first value); use only as fallback.
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  );
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

  // IP allowlist: apply tenant's allowlist to API key callers too (not just browser sessions).
  // Fail open when the allowlist cannot be read to avoid locking out API integrations.
  try {
    const svc = createSupabaseServiceClient();
    const { data: cfg } = await svc
      .from("platform_config")
      .select("value")
      .eq("tenant_id", auth.tenantId)
      .eq("key", "ip_allowlist")
      .maybeSingle();
    if (cfg) {
      const list: string[] = (() => { try { const p = JSON.parse(cfg.value as string); return Array.isArray(p) ? p : []; } catch { return []; } })();
      if (list.length > 0) {
        const ip = clientIp(req);
        if (!isIpAllowed(ip, list)) {
          return { error: apiError("forbidden", "Your IP address is not on the allowlist for this workspace.") };
        }
      }
    }
  } catch {
    // Fail open — log but don't block legitimate API traffic on DB errors
    console.error("[gate] IP allowlist check failed for tenant", auth.tenantId);
  }

  const rl = getRateLimiter();
  const k = await rl.check(`key:${auth.keyId}`, KEY_LIMIT, WINDOW_MS);
  const t = await rl.check(`tenant:${auth.tenantId}`, TENANT_LIMIT, WINDOW_MS);
  if (!k.allowed || !t.allowed) {
    return { error: apiError("rate_limited", "Rate limit exceeded. Slow down.") };
  }
  return { auth };
}
