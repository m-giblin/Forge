import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET /api/spaces/pages?slug=xxx&spaceId=xxx  — list pages in a space
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const spaceId = searchParams.get("spaceId");
  if (!slug || !spaceId) return NextResponse.json({ error: "slug and spaceId required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  // Verify space belongs to tenant
  const { data: space } = await svc
    .from("spaces")
    .select("id, type, owner_id")
    .eq("id", spaceId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });
  if (space.type === "personal" && space.owner_id !== ctx.appUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await svc
    .from("pages")
    .select("id, parent_id, title, icon, position, status, last_reviewed_at, created_by, updated_by, created_at, updated_at")
    .eq("space_id", spaceId)
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "active")
    .order("position")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/spaces/pages — create a new page
export async function POST(req: Request) {
  const body = await req.json();
  const { slug, spaceId, parentId, title, icon } = body as {
    slug: string; spaceId: string; parentId?: string; title?: string; icon?: string;
  };
  if (!slug || !spaceId) return NextResponse.json({ error: "slug and spaceId required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const { data: space } = await svc
    .from("spaces")
    .select("id, type, owner_id")
    .eq("id", spaceId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });
  if (space.type === "personal" && space.owner_id !== ctx.appUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get position (append to end of siblings)
  let siblingQuery = svc
    .from("pages")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId)
    .eq("tenant_id", ctx.tenant.id);
  if (parentId) siblingQuery = siblingQuery.eq("parent_id", parentId);
  else siblingQuery = siblingQuery.is("parent_id", null);
  const { count } = await siblingQuery;

  const { data, error } = await svc
    .from("pages")
    .insert({
      tenant_id: ctx.tenant.id,
      space_id: spaceId,
      parent_id: parentId ?? null,
      title: title?.trim() || "Untitled",
      icon: icon ?? null,
      body: "",
      position: count ?? 0,
      created_by: ctx.appUserId,
      updated_by: ctx.appUserId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
