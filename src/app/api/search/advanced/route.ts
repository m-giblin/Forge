import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: search bypasses RLS but explicit tenant_id filter enforces isolation (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parseAql, runSearchQuery } from "@/lib/services/searchQuery";

export const runtime = "nodejs";

const RESULT_LIMIT = 200;

/**
 * GET /api/search/advanced?slug=<tenant>&q=<AQL query>
 * The Advanced Search page's endpoint — same filtering engine as /api/search
 * (the command palette), just a higher result cap and fuller per-result
 * fields for a real results table, and AQL syntax (`field = "value"`)
 * translated to the same token language before being parsed.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const raw = searchParams.get("q")?.trim() ?? "";

  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!raw) return NextResponse.json({ data: [] });

  const svc = createSupabaseServiceClient();
  try {
    const tokens = parseAql(raw);
    const data = await runSearchQuery(ctx, svc, tokens, { limit: RESULT_LIMIT, includeExtra: true });
    return NextResponse.json({ data, truncated: data.length >= RESULT_LIMIT });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed" }, { status: 500 });
  }
}
