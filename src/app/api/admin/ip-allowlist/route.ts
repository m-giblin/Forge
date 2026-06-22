import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { getIpAllowlist, saveIpAllowlist, clearIpAllowlist } from "@/lib/services/ipAllowlist";

// GET  /api/admin/ip-allowlist?tenant=<slug>
// POST /api/admin/ip-allowlist { slug, entries: string[] }
// DELETE /api/admin/ip-allowlist { slug }
// All require owner or admin role.

function requireOwnerAdmin(role: string) {
  return role === "owner" || role === "admin";
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant required" }, { status: 400 });
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireOwnerAdmin(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const entries = await getIpAllowlist(ctx.tenant.id);
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { slug, entries } = body as { slug: string; entries: string[] };
  if (!slug || !Array.isArray(entries)) {
    return NextResponse.json({ error: "slug and entries required" }, { status: 400 });
  }
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireOwnerAdmin(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await saveIpAllowlist(ctx.tenant.id, entries.filter(Boolean));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { slug } = body as { slug: string };
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireOwnerAdmin(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await clearIpAllowlist(ctx.tenant.id);
  return NextResponse.json({ ok: true });
}
