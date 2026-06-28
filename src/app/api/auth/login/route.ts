import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role: SSO domain check before user session exists
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getRateLimiter } from "@/lib/providers/rate-limiter";
import { ssoConfigRepo } from "@/lib/repositories/ssoConfig";

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

  // If this domain has SSO required, block password login entirely.
  const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : null;
  if (domain) {
    const required = await ssoConfigRepo(createSupabaseServiceClient())
      .isDomainSsoRequired(domain)
      .catch(() => false);
    if (required) {
      // Return 401 (not 403) to avoid acting as an SSO oracle — an attacker could
      // enumerate corporate domains by watching for 403 vs 401 responses.
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }
  }

  const ip = clientIp(req);
  const rl = getRateLimiter();

  // Pre-auth gate: block immediately if this IP has exhausted the failure window.
  // Uses a separate "attempt" key so the check itself doesn't burn a failure slot.
  const attemptResult = await rl.check(`authattempt:login:${ip}`, FAIL_LIMIT * 2, FAIL_WINDOW_MS);
  if (!attemptResult.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Count this failure; block once the failure window fills.
    const failResult = await rl.check(`authfail:login:${ip}`, FAIL_LIMIT, FAIL_WINDOW_MS);
    if (!failResult.allowed) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
