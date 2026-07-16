import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: explicit tenant_id filter enforces isolation
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueAssigneesRepo } from "@/lib/repositories/issueAssignees";

export const runtime = "nodejs";

async function ctxFor(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return { error: NextResponse.json({ error: "slug required" }, { status: 400 }) };
  const ctx = await getTenantContext(slug);
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { ctx };
}

// Verify the issue belongs to this tenant; returns its current primary assignee_id.
async function loadIssue(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  issueId: string
) {
  const { data } = await svc
    .from("issues")
    .select("id, assignee_id")
    .eq("tenant_id", tenantId)
    .eq("id", issueId)
    .maybeSingle();
  return data as { id: string; assignee_id: string | null } | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: issueId } = await params;
  const { ctx, error } = await ctxFor(req);
  if (error) return error;

  const svc = createSupabaseServiceClient();
  const assignees = await issueAssigneesRepo(svc).listForIssue(ctx!.tenant.id, issueId);
  return NextResponse.json({ assignees });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: issueId } = await params;
  const { ctx, error } = await ctxFor(req);
  if (error) return error;
  const tenantId = ctx!.tenant.id;

  const { user_id } = (await req.json()) as { user_id?: string };
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const svc = createSupabaseServiceClient();

  const issue = await loadIssue(svc, tenantId, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  // Isolation: the new assignee must be a member of this tenant.
  const { data: membership } = await svc
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user_id)
    .maybeSingle();
  if (!membership)
    return NextResponse.json({ error: "User is not a member of this workspace" }, { status: 422 });

  await issueAssigneesRepo(svc).add(tenantId, issueId, user_id);

  // If the issue had no primary, this becomes it.
  if (!issue.assignee_id) {
    await svc.from("issues").update({ assignee_id: user_id }).eq("tenant_id", tenantId).eq("id", issueId);
  }

  const assignees = await issueAssigneesRepo(svc).listForIssue(tenantId, issueId);
  return NextResponse.json({ assignees });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: issueId } = await params;
  const { ctx, error } = await ctxFor(req);
  if (error) return error;
  const tenantId = ctx!.tenant.id;

  const { user_id } = (await req.json()) as { user_id?: string };
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const svc = createSupabaseServiceClient();

  const issue = await loadIssue(svc, tenantId, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const repo = issueAssigneesRepo(svc);
  await repo.remove(tenantId, issueId, user_id);

  // If we just removed the primary, promote the earliest remaining assignee (or clear it).
  if (issue.assignee_id === user_id) {
    const remaining = await repo.listForIssue(tenantId, issueId);
    const nextPrimary = remaining[0]?.userId ?? null;
    await svc
      .from("issues")
      .update({ assignee_id: nextPrimary })
      .eq("tenant_id", tenantId)
      .eq("id", issueId);
  }

  const assignees = await repo.listForIssue(tenantId, issueId);
  return NextResponse.json({ assignees });
}
