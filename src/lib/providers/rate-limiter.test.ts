import { describe, it, expect, vi, afterEach } from "vitest";
import { getRateLimiter, SupabaseRateLimiter } from "@/lib/providers/rate-limiter";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("in-memory rate limiter", () => {
  it("allows up to the limit, then blocks", async () => {
    const rl = getRateLimiter();
    const key = `test:${Math.random()}`;
    const limit = 3;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rl.check(key, limit, 60_000));
    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
    expect(results[3].allowed).toBe(false);
    expect(results[3].remaining).toBe(0);
  });

  it("resets after the window elapses", async () => {
    const rl = getRateLimiter();
    const key = `test:${Math.random()}`;
    await rl.check(key, 1, 20); // consume the only slot, tiny window
    const blocked = await rl.check(key, 1, 20);
    expect(blocked.allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 30)); // let window expire
    const afterReset = await rl.check(key, 1, 20);
    expect(afterReset.allowed).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    const rl = getRateLimiter();
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    await rl.check(a, 1, 60_000);
    expect((await rl.check(a, 1, 60_000)).allowed).toBe(false);
    expect((await rl.check(b, 1, 60_000)).allowed).toBe(true);
  });
});

// SEC-01: on a shared-store error the limiter must DEGRADE (keep a real ceiling),
// not fail OPEN (allow everything).
describe("SupabaseRateLimiter degrade-on-error (SEC-01)", () => {
  const erroringClient = {
    rpc: async () => ({ data: null, error: { message: "db down" } }),
  } as unknown as SupabaseClient;

  const throwingClient = {
    rpc: async () => {
      throw new Error("connection refused");
    },
  } as unknown as SupabaseClient;

  it("still enforces the limit when rl_increment returns an error (no allow-all)", async () => {
    const rl = new SupabaseRateLimiter(erroringClient);
    const key = `degrade:${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rl.check(key, 2, 60_000));
    expect(results.slice(0, 2).every((r) => r.allowed)).toBe(true);
    expect(results[2].allowed).toBe(false); // would be true if it failed open
    expect(results[3].allowed).toBe(false);
  });

  it("degrades (not allow-all) when the rpc throws", async () => {
    const rl = new SupabaseRateLimiter(throwingClient);
    const key = `degrade2:${Math.random()}`;
    expect((await rl.check(key, 1, 60_000)).allowed).toBe(true);
    expect((await rl.check(key, 1, 60_000)).allowed).toBe(false);
  });
});

// SEC-01: production must refuse the unshared in-memory limiter.
describe("getRateLimiter production boot assertion (SEC-01)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws in production when the shared store env is missing", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const mod = await import("@/lib/providers/rate-limiter");
    expect(() => mod.getRateLimiter()).toThrow(/Refusing to start/);
  });

  it("allows in-memory outside production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const mod = await import("@/lib/providers/rate-limiter");
    expect(() => mod.getRateLimiter()).not.toThrow();
  });
});
