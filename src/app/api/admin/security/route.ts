import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET  /api/admin/security?tenant=<slug>  — read require_mfa
// POST /api/admin/security               — update require_mfa
// Both require owner or admin role.

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("require_mfa")
    .eq("id", ctx.tenant.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requireMfa: data.require_mfa ?? false });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { slug, requireMfa } = body as { slug: string; requireMfa: boolean };
  if (!slug || typeof requireMfa !== "boolean") {
    return NextResponse.json({ error: "slug and requireMfa required" }, { status: 400 });
  }

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenants")
    .update({ require_mfa: requireMfa })
    .eq("id", ctx.tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, requireMfa });
}
