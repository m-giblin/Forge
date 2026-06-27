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
