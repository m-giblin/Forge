import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Constant-time secret verification for /api/internal/ routes.
 *
 * Every /api/internal/ handler MUST call this at the top of its handler function.
 * The proxy skips session auth for internal routes — per-route validation is the
 * only protection. This wrapper makes the pattern explicit and impossible to forget.
 *
 * Usage:
 *   const denied = enforceInternalSecret(req, process.env.MY_INTERNAL_SECRET);
 *   if (denied) return denied;
 */
export function enforceInternalSecret(req: NextRequest, secret: string | undefined): Response | null {
  const provided = req.headers.get("x-g4-secret") ?? req.headers.get("authorization")?.replace(/^Bearer /, "");
  const expected = secret ?? "";

  if (!provided || !expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const maxLen = Math.max(provided.length, expected.length, 32);
  const a = Buffer.alloc(maxLen);
  const b = Buffer.alloc(maxLen);
  a.write(provided);
  b.write(expected);

  if (!timingSafeEqual(a, b)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
