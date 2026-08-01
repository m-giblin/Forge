import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- admin API (generateLink) requires service-role, no session exists yet
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getRateLimiter } from "@/lib/providers/rate-limiter";
import { sendPasswordResetEmail } from "@/lib/services/notifications";

// Generous but real limit — this is a self-service, unauthenticated endpoint.
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Self-service "forgot password" — generates the recovery link via the
 * Supabase Admin API and sends it through the app's own Resend pipeline,
 * bypassing Supabase Auth's built-in (unconfigured-SMTP) email delivery
 * that the login page's original client-side resetPasswordForEmail() call
 * silently depended on.
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  // Always respond ok — never let this endpoint act as an account-existence oracle.
  try {
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${appUrl}/auth/reset-password` },
    });
    if (!linkErr && linkData?.properties?.action_link) {
      await sendPasswordResetEmail({ toEmail: email, resetUrl: linkData.properties.action_link });
    }
  } catch (e) {
    console.error("forgot-password: link generation/send failed", e);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
