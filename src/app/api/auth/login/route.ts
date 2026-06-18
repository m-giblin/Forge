import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

// 10 failed attempts per 15-minute window before a hard block.
// Separate key from API-key brute-force (authfail:ip) — different surface,
// different threat model (human login is slower; 15 min window is appropriate).
const FAIL_LIMIT = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request) {
  let email: string, password: string;
  try {
    ({ email, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const ip = clientIp(req);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Count failure against the IP; block once the window fills.
    const rl = getRateLimiter();
    const result = await rl.check(`authfail:login:${ip}`, FAIL_LIMIT, FAIL_WINDOW_MS);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
