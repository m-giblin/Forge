import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role required for cross-tenant aggregation
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export interface CustomReportRow {
  dimension: string;
  count: number;
  open: number;
  closed: number;
}

export interface CustomReportResult {
  groupBy: string;
  rows: CustomReportRow[];
  totalIssues: number;
  from: string;
  to: string;
}

const VALID_GROUP_BY = ["status", "priority", "type", "assignee"] as const;
type GroupBy = (typeof VALID_GROUP_BY)[number];

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.pathname.split("/")[1]; // /{slug}/... doesn't apply — this is /api/...
  // Extract slug from the Referer or custom header set by the client
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug header" }, { status: 400 });

  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const rawGroupBy = (sp.get("groupBy") ?? "status") as GroupBy;
  const groupBy: GroupBy = VALID_GROUP_BY.includes(rawGroupBy) ? rawGroupBy : "status";
  const projectId = sp.get("project") || null;
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const fromStr = sp.get("from") ?? defaultFrom.toISOString().slice(0, 10);
  const toStr = sp.get("to") ?? now.toISOString().slice(0, 10);

  const svc = createSupabaseServiceClient();

  let q = svc
    .from("issues")
    .select("status, priority, type, assignee_id, users!issues_assignee_id_fkey(email)")
    .eq("tenant_id", ctx.tenant.id)
    .gte("created_at", `${fromStr}T00:00:00Z`)
    .lte("created_at", `${toStr}T23:59:59Z`);

  if (projectId) q = q.eq("project_id", projectId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type IssueRow = {
    status: string;
    priority: string;
    type: string;
    assignee_id: string | null;
    users: { email: string } | null;
  };
  const issues = (data ?? []) as unknown as IssueRow[];

  // Aggregate by chosen dimension
  const map = new Map<string, { count: number; open: number; closed: number }>();
  const closedStatuses = new Set(["done"]);

  for (const issue of issues) {
    let key: string;
    if (groupBy === "status") key = issue.status || "unknown";
    else if (groupBy === "priority") key = issue.priority || "none";
    else if (groupBy === "type") key = issue.type || "task";
    else key = issue.users?.email ?? "Unassigned";

    const existing = map.get(key) ?? { count: 0, open: 0, closed: 0 };
    existing.count++;
    if (closedStatuses.has(issue.status)) existing.closed++;
    else existing.open++;
    map.set(key, existing);
  }

  const rows: CustomReportRow[] = Array.from(map.entries())
    .map(([dimension, stats]) => ({ dimension, ...stats }))
    .sort((a, b) => b.count - a.count);

  const result: CustomReportResult = {
    groupBy,
    rows,
    totalIssues: issues.length,
    from: fromStr,
    to: toStr,
  };

  void slug; // suppress unused warning from path split above
  return NextResponse.json(result);
}
