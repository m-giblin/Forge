import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rate limiter behind a small interface so the implementation is swappable
 * (Architecture: provider adapters). Uses Supabase as a shared scoreboard so
 * all serverless instances share the same tallies. Falls back to in-memory
 * when the DB is unavailable (dev/test without a live DB).
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
class SupabaseRateLimiter implements RateLimiter {
  constructor(private supabase: SupabaseClient) {}

  async check(key: string, limit: number, windowMs: number) {
    const { data, error } = await this.supabase.rpc("rl_increment", {
      p_key: key,
      p_window_ms: windowMs,
    });

    if (error || !data?.[0]) {
      // DB error — fail open so a DB hiccup doesn't take down the API.
      console.error("rate-limiter supabase error, failing open", error);
      return { allowed: true, remaining: limit, resetMs: windowMs };
    }

    const { new_count, reset_at } = data[0] as { new_count: number; reset_at: string };
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
  } else {
    _limiter = new InMemoryRateLimiter();
  }

  return _limiter;
}
