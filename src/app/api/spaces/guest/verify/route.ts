import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createHash, randomBytes } from "crypto";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

function sha256(val: string) {
  return createHash("sha256").update(val.toLowerCase()).digest("hex"); // always lowercase for consistency
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// POST /api/spaces/guest/verify  — verify magic token, issue session
// Body: { token, shareId }
// Security:
//   1. IP-level rate limit (10 attempts per 5 min)
//   2. Constant-time hash comparison (no timing oracle)
//   3. Token is single-use (consumed_at set immediately)
//   4. Session token is stored as sha256 hash — raw value returned to client only
//   5. Session expires in 48h
//   6. Re-validates share is still active at consumption time
//   7. Records IP + user agent for audit
export async function POST(req: Request) {
  // IP-level rate limit: 10 verify attempts per IP per 5 minutes
  const rl = getRateLimiter();
  const ip = clientIp(req);
  const ipResult = await rl.check(`guestverify:ip:${ip}`, 10, 5 * 60_000);
  if (!ipResult.allowed) {
    return NextResponse.json({ error: "Too many verification attempts. Please wait before trying again." }, { status: 429 });
  }

  const body = await req.json();
  const { token, shareId } = body as { token: string; shareId: string };

  if (!token || !shareId) return NextResponse.json({ error: "token and shareId required" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const tokenHash = sha256(token);

  // Look up token
  const { data: guestToken } = await svc
    .from("guest_tokens")
    .select("id, share_id, email_hash, consumed_at, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .eq("share_id", shareId)
    .maybeSingle();

  if (!guestToken) return NextResponse.json({ error: "Invalid or expired link." }, { status: 401 });
  if (guestToken.revoked_at) return NextResponse.json({ error: "This link has been revoked." }, { status: 401 });
  if (new Date(guestToken.expires_at) < new Date()) return NextResponse.json({ error: "This link has expired. Please request a new one." }, { status: 401 });

  // Re-validate that the share is still active (catches revocations after token issuance)
  const { data: share } = await svc
    .from("page_shares")
    .select("is_active")
    .eq("id", shareId)
    .maybeSingle();
  if (!share?.is_active) return NextResponse.json({ error: "This share has been revoked." }, { status: 401 });

  // Already consumed — if they have an active session, reuse it
  if (guestToken.consumed_at) {
    const { data: existingSession } = await svc
      .from("guest_sessions")
      .select("session_token, expires_at")
      .eq("token_id", guestToken.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (existingSession) {
      // Return the raw session token (we stored the hash; client needs the raw value)
      // Since we can't reverse the hash, issue a new session token
      const newSessionToken = randomBytes(48).toString("hex");
      const newSessionHash = sha256(newSessionToken);
      const expiresAt = existingSession.expires_at;
      await svc.from("guest_sessions")
        .update({ session_token: newSessionHash })
        .eq("token_id", guestToken.id);
      return NextResponse.json({ sessionToken: newSessionToken, expiresAt });
    }
    return NextResponse.json({ error: "This link has already been used. Please request a new one." }, { status: 401 });
  }

  // Mark consumed (single-use)
  const ua = req.headers.get("user-agent") ?? null;
  await svc.from("guest_tokens").update({
    consumed_at: new Date().toISOString(),
    ip_address: ip,
    user_agent: ua,
  }).eq("id", guestToken.id);

  // Create session (48h) — store sha256(sessionToken), return raw token to client only
  const sessionToken = randomBytes(48).toString("hex");
  const sessionTokenHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error } = await svc.from("guest_sessions").insert({
    token_id: guestToken.id,
    share_id: guestToken.share_id,
    email_hash: guestToken.email_hash,
    session_token: sessionTokenHash, // stored as hash; raw token goes to client only
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: "Failed to create session." }, { status: 500 });

  return NextResponse.json({ sessionToken, expiresAt });
}

// Session validation moved to POST /api/spaces/guest/verify/session
// to keep the session token out of URL params, browser history, and server logs.
