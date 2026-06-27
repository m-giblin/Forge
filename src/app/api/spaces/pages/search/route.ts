import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET /api/spaces/pages/search?slug=xxx&q=xxx  — full-text search across tenant pages
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const q = searchParams.get("q")?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  if (!q || q.length < 2) return NextResponse.json({ data: [] });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createSupabaseServiceClient();

  // Full-text search using Postgres tsvector
  const { data, error } = await svc
    .from("pages")
    .select("id, space_id, title, icon, updated_at, spaces(id, name, type, owner_id)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "active")
    .textSearch("title", q, { type: "websearch", config: "english" })
    .limit(20);

  if (error) {
    // Fallback to ilike if FTS fails
    const { data: fallback } = await svc
      .from("pages")
      .select("id, space_id, title, icon, updated_at, spaces(id, name, type, owner_id)")
      .eq("tenant_id", ctx.tenant.id)
      .eq("status", "active")
      .ilike("title", `%${q}%`)
      .limit(20);
    const filtered = (fallback ?? []).filter((p) => {
      const s = (Array.isArray(p.spaces) ? p.spaces[0] : p.spaces) as { type: string; owner_id: string } | null;
      return s?.type !== "personal" || s.owner_id === ctx.appUserId;
    });
    return NextResponse.json({ data: filtered });
  }

  // Filter out personal spaces from other users
  const filtered = (data ?? []).filter((p) => {
    const s = (Array.isArray(p.spaces) ? p.spaces[0] : p.spaces) as { type: string; owner_id: string } | null;
    return s?.type !== "personal" || s.owner_id === ctx.appUserId;
  });

  return NextResponse.json({ data: filtered });
}
