import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createHash, randomBytes } from "crypto";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // max 5 requests per email per share per hour

function sha256(val: string) {
  return createHash("sha256").update(val.toLowerCase()).digest("hex");
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// POST /api/spaces/guest/request  — guest requests a magic link to view a shared page
// Body: { shareId, email }
// Security layers:
//   1. IP-level rate limit (10/hr) before any DB work
//   2. Validates shareId is active
//   3. Validates email matches allowed_domain
//   4. Blocks generic email providers
//   5. Rate-limits requests per (shareId, email) within 1hr window
//   6. Stores only sha256(token) — raw token sent by email only, never stored
//   7. Tokens expire in 1 hour; sessions last 48 hours after first use
export async function POST(req: Request) {
  // IP-level rate limit: 10 magic-link requests per IP per hour
  const rl = getRateLimiter();
  const ip = clientIp(req);
  const ipResult = await rl.check(`guestreq:ip:${ip}`, 10, 60 * 60_000);
  if (!ipResult.allowed) {
    return NextResponse.json({ error: "Too many requests from this IP. Please wait before trying again." }, { status: 429 });
  }

  const body = await req.json();
  const { shareId, email } = body as { shareId: string; email: string };

  if (!shareId || !email) return NextResponse.json({ error: "shareId and email required" }, { status: 400 });

  const cleanEmail = email.toLowerCase().trim();
  const emailDomain = cleanEmail.split("@")[1];
  if (!emailDomain) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  // Block generic providers
  const blockedDomains = ["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com","aol.com","protonmail.com","live.com","msn.com"];
  if (blockedDomains.includes(emailDomain)) {
    return NextResponse.json({ error: "Please use your company email address." }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  // Verify share is active and email domain matches
  const { data: share } = await svc
    .from("page_shares")
    .select("id, allowed_domain, page_id, space_id, is_active")
    .eq("id", shareId)
    .eq("is_active", true)
    .single();

  if (!share) return NextResponse.json({ error: "Share not found or revoked." }, { status: 404 });
  if (share.allowed_domain && share.allowed_domain !== emailDomain) {
    return NextResponse.json({ error: `Access restricted to @${share.allowed_domain} emails.` }, { status: 403 });
  }

  const emailHash = sha256(cleanEmail);

  // Rate limit: max 5 requests per (shareId, emailHash) per hour
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await svc
    .from("guest_tokens")
    .select("id", { count: "exact", head: true })
    .eq("share_id", shareId)
    .eq("email_hash", emailHash)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

  // Check for existing valid (unconsumed, unexpired) token — reuse it
  const { data: existing } = await svc
    .from("guest_tokens")
    .select("id, token_hash, expires_at")
    .eq("share_id", shareId)
    .eq("email_hash", emailHash)
    .is("consumed_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  let rawToken: string;

  if (existing) {
    // Reuse: we can't reverse the hash, so generate a fresh token and update
    rawToken = randomBytes(32).toString("hex");
    const newHash = sha256(rawToken);
    await svc.from("guest_tokens").update({
      token_hash: newHash,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).eq("id", existing.id);
  } else {
    // New token
    rawToken = randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error } = await svc.from("guest_tokens").insert({
      share_id: shareId,
      email_hash: emailHash,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (error) return NextResponse.json({ error: "Failed to create access token." }, { status: 500 });
  }

  // Determine what they're accessing for email copy
  const accessUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"}/shared/page?token=${rawToken}&share=${shareId}`;

  // Send magic link via Resend
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@forge-worx.com";

  try {
    await resend.emails.send({
      from: fromEmail,
      to: cleanEmail,
      subject: "Your read-only access link – Forge-Worx Spaces",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <div style="margin-bottom:24px">
            <img src="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"}/logo-384.png" alt="Forge-Worx" style="height:40px"/>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#111;margin:0 0 12px">Read-only access to a shared page</h2>
          <p style="font-size:15px;color:#444;margin:0 0 24px;line-height:1.6">
            Someone has shared a page with you on Forge-Worx. Click the button below to view it.
            This link is valid for <strong>1 hour</strong> and grants <strong>read-only access</strong> —
            you won't be able to edit or modify anything.
          </p>
          <a href="${accessUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600">
            View Page →
          </a>
          <p style="font-size:13px;color:#888;margin:24px 0 0;line-height:1.5">
            If you didn't request this, you can safely ignore this email. This link can only be used once.
            Your session will expire after 48 hours.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="font-size:12px;color:#aaa;margin:0">
            Access restricted to @${emailDomain} email addresses. Powered by <a href="https://forge-worx.com" style="color:#aaa">Forge-Worx</a>.
          </p>
        </div>
      `,
    });
  } catch {
    // Log but don't expose email failure to client (prevents oracle attack)
    console.error("[guest/request] email send failed");
  }

  // Always return success — prevents email enumeration
  return NextResponse.json({ ok: true, message: "Check your email for your access link." });
}
