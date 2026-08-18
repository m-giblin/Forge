import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

// IP-level rate limit: public, unauthenticated endpoint — same 10/hr pattern
// used for other public no-session endpoints (api/signup, api/spaces/guest/request).
const WAITLIST_LIMIT = 10;
const WAITLIST_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  const rl = getRateLimiter();
  const ip = clientIp(req);
  const ipResult = await rl.check(`waitlist:ip:${ip}`, WAITLIST_LIMIT, WAITLIST_WINDOW_MS);
  if (!ipResult.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait before trying again." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("waitlist_signups").insert({ email });
  // A duplicate email (unique constraint, code 23505) is still a success from
  // the visitor's point of view — they're already on the list.
  if (error && error.code !== "23505") {
    console.error("[waitlist] insert failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
