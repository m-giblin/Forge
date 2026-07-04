import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createHash } from "crypto";

function sha256(val: string) {
  return createHash("sha256").update(val.toLowerCase()).digest("hex");
}

// POST /api/spaces/guest/verify/session — validate an existing guest session
// Body in request body (never URL params) to keep the token out of logs/history.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionToken = body?.sessionToken as string | undefined;
  const shareId = body?.shareId as string | undefined;

  if (!sessionToken || !shareId) return NextResponse.json({ valid: false });

  const svc = createSupabaseServiceClient();
  const sessionTokenHash = sha256(sessionToken);

  const { data } = await svc
    .from("guest_sessions")
    .select("id, expires_at, share_id")
    .eq("session_token", sessionTokenHash)
    .eq("share_id", shareId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, expiresAt: data.expires_at });
}
