import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("projects")
    .select("budget_cents, budget_alert_threshold_pct")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    budgetCents: data.budget_cents ?? null,
    budgetAlertThresholdPct: data.budget_alert_threshold_pct ?? null,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    budgetCents?: number | null;
    budgetAlertThresholdPct?: number | null;
    slug?: string;
  };

  const slug = body.slug;
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if ("budgetCents" in body) patch.budget_cents = body.budgetCents ?? null;
  if ("budgetAlertThresholdPct" in body) patch.budget_alert_threshold_pct = body.budgetAlertThresholdPct ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("projects")
    .update(patch)
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
