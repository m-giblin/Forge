import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line no-restricted-imports -- admin API (updateUserById) requires service-role, no session exists yet
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getRateLimiter } from "@/lib/providers/rate-limiter";
import { publicEnv } from "@/lib/env";

// Tighter than the "send a code" limit — this endpoint is what an attacker
// would actually hammer to brute-force the code. Locking to a handful of
// attempts per email makes that impractical long before it matters,
// independent of the code's own 60-minute expiry.
const LIMIT = 8;
const WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Completes the self-service (and admin-triggered) password reset: verifies
 * the numeric code Supabase emailed against this email, then sets the new
 * password directly via the Admin API. No magic link, no client-side session
 * hand-off from a URL hash — the code itself is the proof of ownership.
 * Length isn't hardcoded to 6 — Supabase's email OTP length is a project-level
 * setting (this project's is actually 8), so validate on digits-only + a
 * reasonable range instead of assuming a fixed length.
 */
export async function POST(req: Request) {
  let email: string, code: string, newPassword: string;
  try {
    ({ email, code, newPassword } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!code || typeof code !== "string" || !/^\d{6,10}$/.test(code)) {
    return NextResponse.json({ error: "Enter the verification code from your email." }, { status: 400 });
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const ip = clientIp(req);
  const rl = getRateLimiter();
  // Rate-limit per email+IP combined so one attacker can't burn through a
  // victim's attempt budget to lock them out, and can't spray many emails
  // from one IP either.
  const rateResult = await rl.check(`authattempt:reset-otp-verify:${email.toLowerCase()}:${ip}`, LIMIT, WINDOW_MS);
  if (!rateResult.allowed) {
    return NextResponse.json({ error: "Too many attempts. Request a new code and try again later." }, { status: 429 });
  }

  const pub = publicEnv();
  const anon = createClient(pub.NEXT_PUBLIC_SUPABASE_URL, pub.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await anon.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error || !data?.user) {
    return NextResponse.json({ error: "That code is invalid or has expired. Request a new one." }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();
  const { error: updateErr } = await svc.auth.admin.updateUserById(data.user.id, { password: newPassword });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message || "Couldn't update the password. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
