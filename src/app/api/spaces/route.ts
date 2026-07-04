import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET /api/spaces?slug=xxx  — list all spaces the user can see
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const { data, error } = await svc
    .from("spaces")
    .select("id, type, project_id, owner_id, name, icon, description, archived_at, created_at, updated_at, projects(key, name)")
    .eq("tenant_id", ctx.tenant.id)
    .is("archived_at", null)
    .order("type")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Personal spaces: only owner sees their own
  const filtered = (data ?? []).filter((s) => {
    if (s.type === "personal") return s.owner_id === ctx.appUserId;
    return true;
  });

  return NextResponse.json({ data: filtered });
}

// POST /api/spaces — create a new team or personal space
export async function POST(req: Request) {
  const body = await req.json();
  const { slug, type, name, icon, description } = body as {
    slug: string; type: "team" | "personal"; name: string; icon?: string; description?: string;
  };
  if (!slug || !type || !name) return NextResponse.json({ error: "slug, type, name required" }, { status: 400 });
  if (!["team", "personal"].includes(type)) return NextResponse.json({ error: "type must be team or personal" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const { data, error } = await svc
    .from("spaces")
    .insert({
      tenant_id: ctx.tenant.id,
      type,
      owner_id: ctx.appUserId,
      name: name.trim(),
      icon: icon ?? (type === "personal" ? "🧠" : "📚"),
      description: description ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

// DELETE /api/spaces?slug=xxx&id=xxx — delete a team or personal space (owner/admin only, not project spaces)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const id = searchParams.get("id");
  if (!slug || !id) return NextResponse.json({ error: "slug and id required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  // Fetch the space first to enforce ownership rules
  const { data: space } = await svc
    .from("spaces")
    .select("type, owner_id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .single();

  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (space.type === "project") return NextResponse.json({ error: "Project spaces cannot be deleted here" }, { status: 403 });
  // Personal spaces: only the owner can delete. Team spaces: owner/admin only.
  const isOwnerAdmin = ctx.role === "owner" || ctx.role === "admin";
  const isSpaceOwner = space.owner_id === ctx.appUserId;
  if (!isSpaceOwner && !isOwnerAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await svc.from("spaces").delete().eq("tenant_id", ctx.tenant.id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
