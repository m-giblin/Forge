import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET /api/spaces/share?slug=xxx&pageId=xxx  — get share settings for a page
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const pageId = searchParams.get("pageId");
  const spaceId = searchParams.get("spaceId");
  if (!slug || (!pageId && !spaceId)) return NextResponse.json({ error: "slug + pageId or spaceId required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();
  const q = svc.from("page_shares").select("*").eq("tenant_id", ctx.tenant.id).eq("is_active", true);
  const { data } = pageId ? await q.eq("page_id", pageId) : await q.eq("space_id", spaceId!);
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/spaces/share — create or update share settings
export async function POST(req: Request) {
  const body = await req.json();
  const { slug, pageId, spaceId, allowedDomain } = body as {
    slug: string; pageId?: string; spaceId?: string; allowedDomain: string;
  };

  if (!slug || (!pageId && !spaceId)) return NextResponse.json({ error: "slug + pageId or spaceId required" }, { status: 400 });
  if (!allowedDomain) return NextResponse.json({ error: "allowedDomain required" }, { status: 400 });

  // Validate domain format
  const domainPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;
  const cleanDomain = allowedDomain.toLowerCase().trim().replace(/^@/, "");
  if (!domainPattern.test(cleanDomain)) {
    return NextResponse.json({ error: "Invalid domain format (e.g. acme.com)" }, { status: 400 });
  }

  // Block generic/free email providers
  const blockedDomains = ["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com","aol.com","protonmail.com","live.com","msn.com"];
  if (blockedDomains.includes(cleanDomain)) {
    return NextResponse.json({ error: "Cannot share with a generic email provider. Use a company domain." }, { status: 400 });
  }

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only owner/admin or the page's editor can share
  if (ctx.role !== "owner" && ctx.role !== "admin" && ctx.role !== "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createSupabaseServiceClient();

  // Upsert: deactivate old share for this page/space, create new one
  if (pageId) {
    await svc.from("page_shares").update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: ctx.appUserId })
      .eq("tenant_id", ctx.tenant.id).eq("page_id", pageId).eq("is_active", true);
  } else {
    await svc.from("page_shares").update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: ctx.appUserId })
      .eq("tenant_id", ctx.tenant.id).eq("space_id", spaceId!).eq("is_active", true);
  }

  const { data, error } = await svc
    .from("page_shares")
    .insert({
      tenant_id: ctx.tenant.id,
      page_id: pageId ?? null,
      space_id: spaceId ?? null,
      created_by: ctx.appUserId,
      share_type: "domain",
      allowed_domain: cleanDomain,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

// DELETE /api/spaces/share — revoke a share
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const shareId = searchParams.get("shareId");
  if (!slug || !shareId) return NextResponse.json({ error: "slug and shareId required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("page_shares")
    .update({ is_active: false, revoked_at: new Date().toISOString(), revoked_by: ctx.appUserId })
    .eq("id", shareId)
    .eq("tenant_id", ctx.tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also invalidate all guest sessions for this share
  await svc.from("guest_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("share_id", shareId);

  return NextResponse.json({ ok: true });
}
