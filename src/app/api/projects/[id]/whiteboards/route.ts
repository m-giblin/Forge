import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: project lookup always scoped to tenantId (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/whiteboards — list whiteboards for a project */
export async function GET(req: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("project_whiteboards")
    .select("id, name, thumbnail, created_by, updated_by, created_at, updated_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

/** POST /api/projects/[id]/whiteboards — create a new whiteboard */
export async function POST(req: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = (typeof body.name === "string" && body.name.trim()) || "Whiteboard";

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("project_whiteboards")
    .insert({
      tenant_id: ctx.tenant.id,
      project_id: projectId,
      name,
      created_by: ctx.appUserId ?? null,
    })
    .select("id, name, thumbnail, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
