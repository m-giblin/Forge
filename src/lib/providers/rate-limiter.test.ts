import { describe, it, expect } from "vitest";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

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
