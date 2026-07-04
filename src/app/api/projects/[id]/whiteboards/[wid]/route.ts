import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: always scoped to tenantId (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string; wid: string }>;
}

/** GET /api/projects/[id]/whiteboards/[wid] — load whiteboard state */
export async function GET(req: Request, { params }: RouteParams) {
  const { id: projectId, wid } = await params;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("project_whiteboards")
    .select("id, name, state, created_by, updated_by, created_at, updated_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .eq("id", wid)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

/** PATCH /api/projects/[id]/whiteboards/[wid] — save whiteboard state */
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: projectId, wid } = await params;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_by: ctx.appUserId ?? null };
  if (body.state !== undefined) patch.state = body.state;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.thumbnail === "string") patch.thumbnail = body.thumbnail;

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("project_whiteboards")
    .update(patch)
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .eq("id", wid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/projects/[id]/whiteboards/[wid] — delete a whiteboard */
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id: projectId, wid } = await params;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("project_whiteboards")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .eq("id", wid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
