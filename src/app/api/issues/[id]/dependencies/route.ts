import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: issueId } = await params;
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const { data, error } = await svc
    .from("issue_dependencies")
    .select("id, from_issue_id, to_issue_id, type")
    .eq("tenant_id", ctx.tenant.id)
    .or(`from_issue_id.eq.${issueId},to_issue_id.eq.${issueId}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dependencies: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fromIssueId } = await params;
  const body = await req.json();
  const { slug, to_issue_id, type = "blocks" } = body as {
    slug: string;
    to_issue_id: string;
    type?: string;
  };

  if (!slug || !to_issue_id)
    return NextResponse.json({ error: "slug and to_issue_id required" }, { status: 400 });
  if (fromIssueId === to_issue_id)
    return NextResponse.json({ error: "Cannot depend on itself" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") return NextResponse.json({ error: "Viewers cannot edit dependencies." }, { status: 403 });

  const svc = createSupabaseServiceClient();

  // Verify both issues belong to this tenant
  const { data: issues } = await svc
    .from("issues")
    .select("id")
    .eq("tenant_id", ctx.tenant.id)
    .in("id", [fromIssueId, to_issue_id]);

  if (!issues || issues.length < 2)
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const { data, error } = await svc
    .from("issue_dependencies")
    .insert({ tenant_id: ctx.tenant.id, from_issue_id: fromIssueId, to_issue_id, type })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dependency: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fromIssueId } = await params;
  const body = await req.json();
  const { slug, to_issue_id, type } = body as {
    slug: string;
    to_issue_id: string;
    type?: string;
  };

  if (!slug || !to_issue_id)
    return NextResponse.json({ error: "slug and to_issue_id required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "viewer") return NextResponse.json({ error: "Viewers cannot edit dependencies." }, { status: 403 });

  const svc = createSupabaseServiceClient();

  let q = svc
    .from("issue_dependencies")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .eq("from_issue_id", fromIssueId)
    .eq("to_issue_id", to_issue_id);

  if (type) q = q.eq("type", type);

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
