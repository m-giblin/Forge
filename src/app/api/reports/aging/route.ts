import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export interface AgingBucket { label: string; days: [number, number | null]; count: number; points: number }
export interface AgingRow { issueId: string; title: string; priority: string; type: string; status: string; assignee: string | null; ageDays: number; createdAt: string }
export interface AgingResult {
  buckets: AgingBucket[];
  byPriority: Record<string, AgingBucket[]>;
  oldest: AgingRow[];
  totalOpen: number;
  avgAgeDays: number;
}

const BUCKETS: { label: string; days: [number, number | null] }[] = [
  { label: "< 7 days",   days: [0, 7] },
  { label: "7–30 days",  days: [7, 30] },
  { label: "30–90 days", days: [30, 90] },
  { label: "90+ days",   days: [90, null] },
];

function inBucket(age: number, bucket: { days: [number, number | null] }): boolean {
  return age >= bucket.days[0] && (bucket.days[1] === null || age < bucket.days[1]);
}

export async function GET(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });

  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("project") || null;

  const svc = createSupabaseServiceClient();
  let q = svc.from("issues")
    .select("id, title, priority, type, status, story_points, created_at, assignee_id, users!issues_assignee_id_fkey(email)")
    .eq("tenant_id", ctx.tenant.id)
    .not("status", "in", '("done","closed")');
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const issues = (data ?? []) as unknown as Array<Record<string, unknown>>;

  const rows: AgingRow[] = issues.map((issue) => {
    const created = new Date(issue.created_at as string);
    const ageDays = Math.floor((now.getTime() - created.getTime()) / 86400000);
    const userObj = issue.users;
    const email = Array.isArray(userObj) ? (userObj[0]?.email ?? null) : ((userObj as Record<string, unknown> | null)?.email ?? null);
    return {
      issueId: issue.id as string, title: issue.title as string,
      priority: issue.priority as string, type: issue.type as string,
      status: issue.status as string, assignee: email as string | null,
      ageDays, createdAt: issue.created_at as string,
    };
  });

  // Global buckets
  const buckets: AgingBucket[] = BUCKETS.map((b) => {
    const matching = rows.filter((r) => inBucket(r.ageDays, b));
    return {
      label: b.label, days: b.days,
      count: matching.length,
      points: matching.reduce((s, r) => {
        const orig = issues.find((i) => i.id === r.issueId);
        return s + ((orig?.story_points as number | null) ?? 0);
      }, 0),
    };
  });

  // By priority breakdown
  const priorities = ["urgent", "high", "medium", "low"];
  const byPriority: Record<string, AgingBucket[]> = {};
  for (const p of priorities) {
    const pRows = rows.filter((r) => r.priority === p);
    byPriority[p] = BUCKETS.map((b) => ({
      label: b.label, days: b.days,
      count: pRows.filter((r) => inBucket(r.ageDays, b)).length,
      points: 0,
    }));
  }

  const avgAgeDays = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.ageDays, 0) / rows.length) : 0;

  return NextResponse.json({
    buckets,
    byPriority,
    oldest: rows.sort((a, b) => b.ageDays - a.ageDays).slice(0, 20),
    totalOpen: rows.length,
    avgAgeDays,
  } satisfies AgingResult);
}
