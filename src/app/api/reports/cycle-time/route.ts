import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export interface CycleTimeItem {
  issueId: string; title: string; priority: string; type: string;
  assignee: string | null; cycleDays: number; createdAt: string; resolvedAt: string;
}
export interface CycleTimeResult {
  avg: number; median: number; p90: number;
  byPriority: Record<string, { avg: number; count: number }>;
  byType: Record<string, { avg: number; count: number }>;
  byAssignee: { name: string; avg: number; count: number }[];
  items: CycleTimeItem[];
  from: string; to: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export async function GET(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug" }, { status: 400 });

  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const defaultFrom = new Date(now); defaultFrom.setDate(defaultFrom.getDate() - 90);
  const fromStr = sp.get("from") ?? defaultFrom.toISOString().slice(0, 10);
  const toStr = sp.get("to") ?? now.toISOString().slice(0, 10);
  const projectId = sp.get("project") || null;

  const svc = createSupabaseServiceClient();

  // Fetch done/closed issues in range
  let q = svc.from("issues")
    .select("id, title, priority, type, assignee_id, created_at, users!issues_assignee_id_fkey(email)")
    .eq("tenant_id", ctx.tenant.id)
    .in("status", ["done", "closed"])
    .gte("created_at", `${fromStr}T00:00:00Z`)
    .lte("created_at", `${toStr}T23:59:59Z`);
  if (projectId) q = q.eq("project_id", projectId);
  const { data: issues, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const issueList = (issues ?? []) as unknown as Array<Record<string, unknown>>;
  const issueIds = issueList.map((i) => i.id as string);

  // Get earliest done/closed status event for each issue
  const eventsRes = issueIds.length > 0
    ? await svc.from("issue_events")
        .select("issue_id, created_at")
        .eq("tenant_id", ctx.tenant.id)
        .eq("field", "status")
        .in("new_value", ["done", "closed"])
        .in("issue_id", issueIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const resolvedAt = new Map<string, string>();
  for (const ev of eventsRes.data ?? []) {
    if (!resolvedAt.has(ev.issue_id as string)) resolvedAt.set(ev.issue_id as string, ev.created_at as string);
  }

  const items: CycleTimeItem[] = [];
  for (const issue of issueList) {
    const res = resolvedAt.get(issue.id as string);
    if (!res) continue;
    const created = new Date(issue.created_at as string);
    const resolved = new Date(res);
    const cycleDays = Math.max(0, (resolved.getTime() - created.getTime()) / 86400000);
    const userObj = issue.users;
    const email = Array.isArray(userObj) ? (userObj[0]?.email ?? null) : ((userObj as Record<string, unknown> | null)?.email ?? null);
    items.push({
      issueId: issue.id as string, title: issue.title as string,
      priority: issue.priority as string, type: issue.type as string,
      assignee: email as string | null,
      cycleDays: Math.round(cycleDays * 10) / 10,
      createdAt: issue.created_at as string, resolvedAt: res,
    });
  }

  const sorted = items.map((i) => i.cycleDays).sort((a, b) => a - b);
  const avg = sorted.length > 0 ? Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 10) / 10 : 0;
  const median = Math.round(percentile(sorted, 50) * 10) / 10;
  const p90 = Math.round(percentile(sorted, 90) * 10) / 10;

  // Group by priority
  const byPriority: Record<string, { sum: number; count: number }> = {};
  for (const item of items) {
    const b = byPriority[item.priority] ?? { sum: 0, count: 0 };
    b.sum += item.cycleDays; b.count++;
    byPriority[item.priority] = b;
  }

  // Group by type
  const byType: Record<string, { sum: number; count: number }> = {};
  for (const item of items) {
    const b = byType[item.type] ?? { sum: 0, count: 0 };
    b.sum += item.cycleDays; b.count++;
    byType[item.type] = b;
  }

  // Group by assignee
  const assigneeMap = new Map<string, { sum: number; count: number }>();
  for (const item of items) {
    const name = item.assignee ?? "Unassigned";
    const b = assigneeMap.get(name) ?? { sum: 0, count: 0 };
    b.sum += item.cycleDays; b.count++;
    assigneeMap.set(name, b);
  }

  return NextResponse.json({
    avg, median, p90,
    byPriority: Object.fromEntries(Object.entries(byPriority).map(([k, v]) => [k, { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }])),
    byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }])),
    byAssignee: Array.from(assigneeMap.entries()).map(([name, v]) => ({ name, avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count })).sort((a, b) => b.avg - a.avg),
    items: items.sort((a, b) => b.cycleDays - a.cycleDays).slice(0, 50),
    from: fromStr, to: toStr,
  } satisfies CycleTimeResult);
}
