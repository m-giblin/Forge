import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET /api/spaces/pages/[pageId]?slug=xxx  — fetch full page with body
export async function GET(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const { data, error } = await svc
    .from("pages")
    .select("*, spaces(id, type, owner_id, name)")
    .eq("id", pageId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const space = (Array.isArray(data.spaces) ? data.spaces[0] : data.spaces) as { type: string; owner_id: string } | null;
  if (space?.type === "personal" && space.owner_id !== ctx.appUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/spaces/pages/[pageId] — update title, body, icon, position
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const body = await req.json();
  const { slug, title, pageBody, icon, position, status } = body as {
    slug: string; title?: string; pageBody?: string; icon?: string; position?: number; status?: string;
  };
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  // Verify ownership/access
  const { data: existing } = await svc
    .from("pages")
    .select("id, space_id, spaces(type, owner_id)")
    .eq("id", pageId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const space = (Array.isArray(existing.spaces) ? existing.spaces[0] : existing.spaces) as { type: string; owner_id: string } | null;
  if (space?.type === "personal" && space.owner_id !== ctx.appUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = { updated_by: ctx.appUserId };
  if (title !== undefined) patch.title = title.trim() || "Untitled";
  if (pageBody !== undefined) patch.body = pageBody;
  if (icon !== undefined) patch.icon = icon;
  if (position !== undefined) patch.position = position;
  if (status !== undefined) {
    patch.status = status;
    if (status === "archived") patch.archived_at = new Date().toISOString();
    else patch.archived_at = null;
  }

  const { data, error } = await svc
    .from("pages")
    .update(patch)
    .eq("id", pageId)
    .eq("tenant_id", ctx.tenant.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/spaces/pages/[pageId] — hard delete (admin/owner only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("pages").delete().eq("id", pageId).eq("tenant_id", ctx.tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
