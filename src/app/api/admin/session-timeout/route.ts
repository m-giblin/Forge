import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: tenant_settings write requires bypass of RLS
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const SETTING_KEY = "session_timeout_minutes";
const DEFAULT_MINUTES = 30;
const MIN_MINUTES = 15;
const MAX_MINUTES = 480; // 8 hours

// GET /api/admin/session-timeout?tenant=<slug>
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("tenant_settings")
    .select("value")
    .eq("tenant_id", ctx.tenant.id)
    .eq("key", SETTING_KEY)
    .maybeSingle();

  const minutes = data?.value ? parseInt(data.value, 10) : DEFAULT_MINUTES;
  return NextResponse.json({ minutes: isNaN(minutes) ? DEFAULT_MINUTES : minutes });
}

// POST /api/admin/session-timeout  { slug, minutes }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { slug, minutes } = body as { slug: string; minutes: number };

  if (!slug || typeof minutes !== "number") {
    return NextResponse.json({ error: "slug and minutes required" }, { status: 400 });
  }
  if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    return NextResponse.json(
      { error: `Timeout must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes` },
      { status: 422 }
    );
  }

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("tenant_settings")
    .upsert(
      { tenant_id: ctx.tenant.id, key: SETTING_KEY, value: String(minutes), updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, minutes });
}
