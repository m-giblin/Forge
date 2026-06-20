import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: search bypasses RLS but explicit tenant_id filter enforces isolation (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * GET /api/search?slug=<tenant>&q=<query>&limit=8
 * Session-authenticated issue search for the command palette.
 * Never exposes data across tenants — always scoped to the caller's tenant.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20);

  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!q) return NextResponse.json({ data: [] });

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc
    .from("issues")
    .select("id, number, title, status, priority, project_id")
    .eq("tenant_id", ctx.tenant.id)
    .ilike("title", `%${q}%`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with project key so we can show e.g. "WEB-12"
  const projectIds = [...new Set((data ?? []).map((r) => r.project_id))];
  const { data: projects } = await svc
    .from("projects")
    .select("id, key")
    .eq("tenant_id", ctx.tenant.id)
    .in("id", projectIds);

  const keyMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.key]));

  const results = (data ?? []).map((r) => ({
    id: r.id,
    key: `${keyMap[r.project_id] ?? "??"}-${r.number}`,
    title: r.title,
    status: r.status,
    priority: r.priority,
  }));

  return NextResponse.json({ data: results });
}
