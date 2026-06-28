import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") throw new Error("Admin required");
}

function nextSendDate(cadence: string, dayOfWeek: number): Date {
  const now = new Date();
  const d = new Date(now);
  if (cadence === "daily") {
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  }
  if (cadence === "weekly" || cadence === "biweekly") {
    const daysUntil = (dayOfWeek - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntil);
    d.setHours(8, 0, 0, 0);
    if (cadence === "biweekly") return d;
    return d;
  }
  if (cadence === "monthly") {
    d.setMonth(d.getMonth() + 1, 1);
    d.setHours(8, 0, 0, 0);
    return d;
  }
  return d;
}

export async function GET(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.from("scheduled_reports")
    .select("*").eq("tenant_id", ctx.tenant.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  try { assertAdmin(ctx.role); } catch { return NextResponse.json({ error: "Admin required" }, { status: 403 }); }

  const body = await req.json();
  const { name, report_type, config, cadence, day_of_week, recipients } = body as Record<string, unknown>;
  if (!name || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: "name and recipients required" }, { status: 400 });
  }

  const dayNum = typeof day_of_week === "number" ? day_of_week : 5;
  const cadenceStr = typeof cadence === "string" ? cadence : "weekly";
  const nextSend = nextSendDate(cadenceStr, dayNum);

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.from("scheduled_reports").insert({
    tenant_id: ctx.tenant.id,
    name, report_type: report_type ?? "custom",
    config: config ?? {},
    cadence: cadenceStr,
    day_of_week: dayNum,
    recipients,
    is_active: true,
    next_send_at: nextSend.toISOString(),
    created_by: ctx.appUserId,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  try { assertAdmin(ctx.role); } catch { return NextResponse.json({ error: "Admin required" }, { status: 403 }); }

  const body = await req.json() as Record<string, unknown>;
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.from("scheduled_reports")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id as string).eq("tenant_id", ctx.tenant.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  try { assertAdmin(ctx.role); } catch { return NextResponse.json({ error: "Admin required" }, { status: 403 }); }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("scheduled_reports").delete().eq("id", id).eq("tenant_id", ctx.tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
