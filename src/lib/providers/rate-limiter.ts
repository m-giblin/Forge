import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Rate limiter behind a small interface so the implementation is swappable
 * (Architecture: provider adapters). Uses Supabase as a shared scoreboard so
 * all serverless instances share the same tallies.
 *
 * SECURITY (SEC-01): two former failure modes are closed here.
 *  1. On a DB error we DEGRADE to a per-instance in-memory counter and emit a
 *     `rate_limiter_degraded` alert — we never silently allow-all. A real
 *     ceiling keeps holding during a DB blip (weaker, but never "off"), without
 *     the self-DoS of hard-failing-closed on the auth-fail throttle.
 *  2. In production we REFUSE to boot with the unshared in-memory limiter — a
 *     missing service-role env is a loud failure, not a silent unprotected run.
 *
 * To swap to Redis later: implement RateLimiter with @upstash/ratelimit and
 * update getRateLimiter() — call sites never change.
 */
export interface RateLimiter {
  /** Returns whether the request is allowed, plus remaining budget. */
  check(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetMs: number }>;
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / no-DB path)
// ---------------------------------------------------------------------------
class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async check(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now >= b.resetAt) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetMs: windowMs };
    }
    b.count += 1;
    const allowed = b.count <= limit;
    return { allowed, remaining: Math.max(0, limit - b.count), resetMs: b.resetAt - now };
  }
}

// ---------------------------------------------------------------------------
// Supabase-backed implementation (production path)
// Uses the rl_increment RPC which atomically increments the counter in one
// round-trip, safe against concurrent serverless instances.
// ---------------------------------------------------------------------------
// F-09: a single degraded event is expected noise during a transient DB blip
// and easy to miss in a log stream. Track a consecutive-failure streak
// per-instance and escalate to a distinct, louder signal once degradation
// looks sustained rather than transient — that's the log key an external
// alert (PagerDuty/Slack) should actually page on.
const SUSTAINED_FAILURE_THRESHOLD = 5;
const SUSTAINED_DURATION_MS = 30_000;

export class SupabaseRateLimiter implements RateLimiter {
  // Per-instance degraded fallback used ONLY when the shared store errors.
  private readonly degraded = new InMemoryRateLimiter();
  private consecutiveFailures = 0;
  private degradedSince: number | null = null;
  private sustainedAlertFired = false;

  constructor(private supabase: SupabaseClient) {}

  async check(key: string, limit: number, windowMs: number) {
    let data: { new_count: number; reset_at: string }[] | null = null;
    let error: unknown = null;
    try {
      const res = await this.supabase.rpc("rl_increment", { p_key: key, p_window_ms: windowMs });
      data = res.data as typeof data;
      error = res.error;
    } catch (e) {
      error = e;
    }

    if (error || !data?.[0]) {
      // DEGRADE, don't disable: keep a real per-instance ceiling + alert.
      // Previously this failed OPEN (allowed: true) — the SEC-01 gap.
      const now = Date.now();
      this.consecutiveFailures++;
      if (this.degradedSince === null) this.degradedSince = now;
      const degradedForMs = now - this.degradedSince;

      logger.error("rate_limiter_degraded", {
        key,
        reason: error instanceof Error ? error.message : String(error ?? "no row returned"),
        consecutiveFailures: this.consecutiveFailures,
      });

      if (
        !this.sustainedAlertFired &&
        (this.consecutiveFailures >= SUSTAINED_FAILURE_THRESHOLD || degradedForMs >= SUSTAINED_DURATION_MS)
      ) {
        this.sustainedAlertFired = true;
        logger.error("rate_limiter_degraded_sustained", {
          consecutiveFailures: this.consecutiveFailures,
          degradedForMs,
          message: "Rate limiter has been degraded to per-instance in-memory for a sustained period — the shared store looks down, not just blipping. Page on this key.",
        });
      }

      return this.degraded.check(key, limit, windowMs);
    }

    // Recovered — reset the streak so a future blip re-evaluates from zero.
    this.consecutiveFailures = 0;
    this.degradedSince = null;
    this.sustainedAlertFired = false;

    const { new_count, reset_at } = data[0];
    const resetMs = Math.max(0, new Date(reset_at).getTime() - Date.now());
    return {
      allowed: new_count <= limit,
      remaining: Math.max(0, limit - new_count),
      resetMs,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory — returns the right implementation based on environment.
// ---------------------------------------------------------------------------
let _limiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (_limiter) return _limiter;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    _limiter = new SupabaseRateLimiter(createClient(url, key));
  } else if (process.env.NODE_ENV === "production") {
    // Refuse to run unprotected: a missing shared store in prod would silently
    // fall back to per-instance in-memory counters (not shared across serverless
    // instances, reset on cold start) — the original "effectively off" risk.
    throw new Error(
      "Rate limiter misconfigured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production. Refusing to start with an unshared in-memory limiter (SEC-01)."
    );
  } else {
    // Dev/test only.
    _limiter = new InMemoryRateLimiter();
  }

  return _limiter;
}
