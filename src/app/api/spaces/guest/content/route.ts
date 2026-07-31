import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createHash } from "crypto";

function sha256(val: string) {
  return createHash("sha256").update(val.toLowerCase()).digest("hex");
}

/**
 * POST /api/spaces/guest/content — the ONLY place a guest's shared-page body
 * is ever sent to the browser. Requires a session token already verified via
 * /api/spaces/guest/verify or /api/spaces/guest/verify/session — the page
 * route itself only ever passes safe pre-gate metadata (title/icon/space),
 * never the body, so there's nothing sensitive in the initial RSC payload
 * for someone holding just the share link to read before completing the
 * email-domain gate.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionToken = body?.sessionToken as string | undefined;
  const shareId = body?.shareId as string | undefined;

  if (!sessionToken || !shareId) {
    return NextResponse.json({ error: "Session required." }, { status: 401 });
  }

  const svc = createSupabaseServiceClient();
  const sessionTokenHash = sha256(sessionToken);

  const { data: session } = await svc
    .from("guest_sessions")
    .select("id, share_id")
    .eq("session_token", sessionTokenHash)
    .eq("share_id", shareId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session expired or invalid." }, { status: 401 });
  }

  const { data: share } = await svc
    .from("page_shares")
    .select("id, page_id, is_active, pages(id, title, body, icon, updated_at, spaces(name, icon))")
    .eq("id", shareId)
    .eq("is_active", true)
    .maybeSingle();

  if (!share) {
    return NextResponse.json({ error: "This share link is no longer active." }, { status: 404 });
  }

  const rawPage = Array.isArray(share.pages) ? share.pages[0] : share.pages;
  if (!rawPage) return NextResponse.json({ error: "Page not found." }, { status: 404 });

  return NextResponse.json({
    title: rawPage.title,
    body: rawPage.body,
    icon: rawPage.icon,
    updatedAt: rawPage.updated_at,
    spaces: rawPage.spaces ?? null,
  });
}
