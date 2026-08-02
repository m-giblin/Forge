import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- admin API (generateLink) requires service-role, no session exists yet
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getRateLimiter } from "@/lib/providers/rate-limiter";
import { sendPasswordResetCodeEmail } from "@/lib/services/notifications";

// Generous but real limit — this is a self-service, unauthenticated endpoint.
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Self-service "forgot password" — mints a Supabase recovery OTP (a 6-digit
 * code, not a magic link) via the Admin API and emails it through the app's
 * own Resend pipeline, bypassing Supabase Auth's built-in (unconfigured-SMTP)
 * email delivery. The code is entered directly on the login page's reset
 * screen (see /api/auth/reset-password-otp) — no redirect-out-and-back.
 */
export async function POST(req: Request) {
  let email: string;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const ip = clientIp(req);
  const rl = getRateLimiter();
  const rateResult = await rl.check(`authattempt:forgot-password:${ip}`, LIMIT, WINDOW_MS);
  if (!rateResult.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const svc = createSupabaseServiceClient();

  // Always respond ok — never let this endpoint act as an account-existence oracle.
  try {
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (!linkErr && linkData?.properties?.email_otp) {
      await sendPasswordResetCodeEmail({ toEmail: email, code: linkData.properties.email_otp });
    }
  } catch (e) {
    console.error("forgot-password: code generation/send failed", e);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
