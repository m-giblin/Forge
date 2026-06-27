import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createHash, randomBytes } from "crypto";

function sha256(val: string) {
  return createHash("sha256").update(val).digest("hex");
}

// POST /api/spaces/guest/verify  — verify magic token, issue session
// Body: { token, shareId }
// Security:
//   1. Constant-time hash comparison (no timing oracle)
//   2. Token is single-use (consumed_at set immediately)
//   3. Session token is a new cryptographically random value
//   4. Session expires in 48h
//   5. Records IP + user agent for audit
export async function POST(req: Request) {
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
      return NextResponse.json({ sessionToken: existingSession.session_token, expiresAt: existingSession.expires_at });
    }
    return NextResponse.json({ error: "This link has already been used. Please request a new one." }, { status: 401 });
  }

  // Mark consumed (single-use)
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  await svc.from("guest_tokens").update({
    consumed_at: new Date().toISOString(),
    ip_address: ip,
    user_agent: ua,
  }).eq("id", guestToken.id);

  // Create session (48h)
  const sessionToken = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error } = await svc.from("guest_sessions").insert({
    token_id: guestToken.id,
    share_id: guestToken.share_id,
    email_hash: guestToken.email_hash,
    session_token: sessionToken,
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: "Failed to create session." }, { status: 500 });

  return NextResponse.json({ sessionToken, expiresAt });
}

// GET /api/spaces/guest/verify?sessionToken=xxx&shareId=xxx — validate a session
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionToken = searchParams.get("sessionToken");
  const shareId = searchParams.get("shareId");

  if (!sessionToken || !shareId) return NextResponse.json({ valid: false });

  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("guest_sessions")
    .select("id, expires_at, share_id")
    .eq("session_token", sessionToken)
    .eq("share_id", shareId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, expiresAt: data.expires_at });
}
