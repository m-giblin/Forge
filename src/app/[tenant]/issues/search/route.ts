import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: search scoped to tenant_id in code (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * GET /[tenant]/issues/search?q=&exclude=<issueId>&excludeIds=<id1,id2>
 *
 * Fast typeahead for issue linking. Searches title by substring.
 * Returns up to 10 results with key, title, status, priority.
 * Excludes the current issue and any already-linked IDs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;
  const ctx = await getTenantContext(tenant);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const exclude = url.searchParams.get("exclude") ?? "";
  const excludeIds = (url.searchParams.get("excludeIds") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (!q) return NextResponse.json({ results: [] });

  const svc = createSupabaseServiceClient();

  let query = svc
    .from("issues")
    .select("id, number, title, status, priority, project:projects!project_id(key)")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "done")
    .ilike("title", `%${q}%`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (exclude) query = query.neq("id", exclude);
  for (const id of excludeIds) query = query.neq("id", id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((r) => {
    const proj = (r as Record<string, unknown>).project as { key: string } | null;
    return {
      id: r.id as string,
      key: `${proj?.key ?? "?"}-${r.number as number}`,
      title: r.title as string,
      status: r.status as string,
      priority: r.priority as string,
    };
  });

  return NextResponse.json({ results });
}
