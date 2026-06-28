import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET /api/issues/baselines?slug=xxx  — list baselines + items for tenant
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  const { data: baselines } = await svc
    .from("timeline_baselines")
    .select("id, name, created_at, timeline_baseline_items(issue_id, start_date, due_date)")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ baselines: baselines ?? [] });
}

// POST /api/issues/baselines — save a new baseline snapshot
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { slug, name } = body as { slug?: string; name?: string };
  if (!slug || !name) return NextResponse.json({ error: "slug and name required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  // Fetch current scheduled issues
  const { data: issueRows } = await svc
    .from("issues")
    .select("id, start_date, due_date")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "done")
    .not("start_date", "is", null)
    .not("due_date", "is", null);

  if (!issueRows?.length) {
    return NextResponse.json({ error: "No scheduled issues to snapshot" }, { status: 400 });
  }

  // Create baseline record
  const { data: baseline, error: bErr } = await svc
    .from("timeline_baselines")
    .insert({ tenant_id: ctx.tenant.id, name, created_by: ctx.appUserId })
    .select("id")
    .single();

  if (bErr || !baseline) {
    return NextResponse.json({ error: "Failed to create baseline" }, { status: 500 });
  }

  // Insert items
  const items = issueRows.map((r) => ({
    baseline_id: baseline.id,
    issue_id: r.id,
    start_date: r.start_date,
    due_date: r.due_date,
  }));

  const { error: iErr } = await svc.from("timeline_baseline_items").insert(items);
  if (iErr) {
    return NextResponse.json({ error: "Failed to save baseline items" }, { status: 500 });
  }

  return NextResponse.json({ baseline: { id: baseline.id, name, items } });
}
