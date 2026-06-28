import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role required for cross-table aggregation
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────
export const VALID_GROUP_BY = ["status", "priority", "type", "assignee", "label", "sprint", "phase", "environment"] as const;
export const VALID_METRICS = ["count", "story_points", "time_logged"] as const;
export const VALID_DATE_GROUP = ["week", "month"] as const;
export type GroupBy = (typeof VALID_GROUP_BY)[number];
export type Metric = (typeof VALID_METRICS)[number];
export type DateGroup = (typeof VALID_DATE_GROUP)[number];

export interface ReportRow {
  dimension: string;
  value: number;
  open: number;
  closed: number;
  pctDone: number;
}

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
  open: number;
  closed: number;
  prevValue?: number;
}

export interface ReportSummary {
  total: number;
  open: number;
  closed: number;
  avgCycleDays: number | null;
  totalStoryPoints: number;
  totalTimeLoggedHours: number;
  pctDone: number;
}

export interface CustomReportResult {
  groupBy: GroupBy;
  metric: Metric;
  rows: ReportRow[];
  trend?: TrendPoint[];
  summary: ReportSummary;
  previousSummary?: ReportSummary;
  from: string;
  to: string;
  prevFrom?: string;
  prevTo?: string;
}

interface IssueRow {
  id: string;
  status: string;
  priority: string;
  type: string;
  assignee_id: string | null;
  assignee_email: string | null;
  labels: string[] | null;
  sprint_id: string | null;
  phase: string | null;
  environment: string | null;
  story_points: number | null;
  created_at: string;
  updated_at: string;
}

const CLOSED_STATUSES = new Set(["done", "closed"]);

// ── Date helpers ──────────────────────────────────────────────────────────────
function toPeriodKey(date: Date, dg: DateGroup): { key: string; label: string } {
  if (dg === "week") {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { key: `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`, label: `W${weekNo}` };
  }
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  return { key: `${y}-${String(m).padStart(2, "0")}`, label };
}

function shiftDateRange(fromStr: string, toStr: string): { prevFrom: string; prevTo: string } {
  const from = new Date(`${fromStr}T00:00:00Z`);
  const to = new Date(`${toStr}T23:59:59Z`);
  const days = Math.ceil((to.getTime() - from.getTime()) / 86400000);
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - days * 86400000);
  return { prevFrom: prevFrom.toISOString().slice(0, 10), prevTo: prevTo.toISOString().slice(0, 10) };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) return NextResponse.json({ error: "Missing x-tenant-slug header" }, { status: 400 });

  const ctxOrNull = await getTenantContext(tenantSlug);
  if (!ctxOrNull) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!ctxCanDo(ctxOrNull, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ctx = ctxOrNull;

  const sp = req.nextUrl.searchParams;
  const rawGroupBy = sp.get("groupBy") ?? "status";
  const groupBy: GroupBy = (VALID_GROUP_BY as readonly string[]).includes(rawGroupBy) ? rawGroupBy as GroupBy : "status";
  const rawMetric = sp.get("metric") ?? "count";
  const metric: Metric = (VALID_METRICS as readonly string[]).includes(rawMetric) ? rawMetric as Metric : "count";
  const trend = sp.get("trend") === "true";
  const rawDG = sp.get("dateGroup") ?? "week";
  const dateGroup: DateGroup = (VALID_DATE_GROUP as readonly string[]).includes(rawDG) ? rawDG as DateGroup : "week";
  const compare = sp.get("compare") === "true";
  const projectId = sp.get("project") || null;

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const fromStr = sp.get("from") ?? defaultFrom.toISOString().slice(0, 10);
  const toStr = sp.get("to") ?? now.toISOString().slice(0, 10);

  const svc = createSupabaseServiceClient();

  // Sprint name lookup
  let sprintMap = new Map<string, string>();
  if (groupBy === "sprint") {
    const { data } = await svc.from("sprints").select("id, name").eq("tenant_id", ctx.tenant.id);
    sprintMap = new Map((data ?? []).map((s) => [s.id as string, s.name as string]));
  }

  // ── Data fetching ─────────────────────────────────────────────────────────
  async function fetchIssues(from: string, to: string): Promise<IssueRow[]> {
    let q = svc
      .from("issues")
      .select("id, status, priority, type, assignee_id, labels, sprint_id, phase, environment, story_points, created_at, updated_at, users!issues_assignee_id_fkey(email)")
      .eq("tenant_id", ctx.tenant.id)
      .gte("created_at", `${from}T00:00:00Z`)
      .lte("created_at", `${to}T23:59:59Z`);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q;
    if (error) throw error;
    return ((data ?? []) as unknown[]).map((row) => {
      const r = row as Record<string, unknown>;
      const userObj = r.users;
      const email = Array.isArray(userObj) ? (userObj[0]?.email ?? null) : ((userObj as Record<string, unknown> | null)?.email ?? null);
      return {
        id: r.id as string,
        status: r.status as string,
        priority: r.priority as string,
        type: r.type as string,
        assignee_id: r.assignee_id as string | null,
        assignee_email: email as string | null,
        labels: r.labels as string[] | null,
        sprint_id: r.sprint_id as string | null,
        phase: r.phase as string | null,
        environment: r.environment as string | null,
        story_points: r.story_points as number | null,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      };
    });
  }

  async function fetchTimeLogs(issueIds: string[]): Promise<Map<string, number>> {
    if (issueIds.length === 0) return new Map();
    const { data } = await svc
      .from("issue_time_logs")
      .select("issue_id, minutes")
      .eq("tenant_id", ctx.tenant.id)
      .in("issue_id", issueIds);
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      const k = row.issue_id as string;
      map.set(k, (map.get(k) ?? 0) + (row.minutes as number));
    }
    return map;
  }

  // ── Aggregation helpers ────────────────────────────────────────────────────
  function getDimensions(issue: IssueRow): string[] {
    switch (groupBy) {
      case "status": return [issue.status || "unknown"];
      case "priority": return [issue.priority || "none"];
      case "type": return [issue.type || "task"];
      case "assignee": return [issue.assignee_email ?? "Unassigned"];
      case "label": {
        const ls = issue.labels;
        return ls && ls.length > 0 ? ls : ["Unlabeled"];
      }
      case "sprint": return [issue.sprint_id ? (sprintMap.get(issue.sprint_id) ?? "Unknown Sprint") : "Backlog"];
      case "phase": return [issue.phase || "No Phase"];
      case "environment": return [issue.environment || "Not Set"];
    }
  }

  function getMetricVal(issue: IssueRow, logMap: Map<string, number>): number {
    if (metric === "count") return 1;
    if (metric === "story_points") return issue.story_points ?? 0;
    return (logMap.get(issue.id) ?? 0) / 60; // hours
  }

  function aggregate(issues: IssueRow[], logMap: Map<string, number>): ReportRow[] {
    const map = new Map<string, { value: number; open: number; closed: number }>();
    for (const issue of issues) {
      const dims = getDimensions(issue);
      const val = getMetricVal(issue, logMap);
      const done = CLOSED_STATUSES.has(issue.status);
      for (const dim of dims) {
        const e = map.get(dim) ?? { value: 0, open: 0, closed: 0 };
        e.value += val;
        if (done) e.closed += val;
        else e.open += val;
        map.set(dim, e);
      }
    }
    return Array.from(map.entries())
      .map(([dimension, s]) => ({
        dimension,
        value: Math.round(s.value * 100) / 100,
        open: Math.round(s.open * 100) / 100,
        closed: Math.round(s.closed * 100) / 100,
        pctDone: s.value > 0 ? Math.round((s.closed / s.value) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  function buildTrend(issues: IssueRow[], logMap: Map<string, number>): TrendPoint[] {
    const map = new Map<string, TrendPoint>();
    for (const issue of issues) {
      const { key, label } = toPeriodKey(new Date(issue.created_at), dateGroup);
      const e = map.get(key) ?? { key, label, value: 0, open: 0, closed: 0 };
      const val = getMetricVal(issue, logMap);
      const done = CLOSED_STATUSES.has(issue.status);
      e.value += val;
      if (done) e.closed += val;
      else e.open += val;
      map.set(key, e);
    }
    return Array.from(map.values())
      .map((p) => ({ ...p, value: Math.round(p.value * 100) / 100, open: Math.round(p.open * 100) / 100, closed: Math.round(p.closed * 100) / 100 }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  function buildSummary(issues: IssueRow[], logMap: Map<string, number>): ReportSummary {
    const total = issues.length;
    const closed = issues.filter((i) => CLOSED_STATUSES.has(i.status));
    const open = total - closed.length;
    let avgCycleDays: number | null = null;
    if (closed.length > 0) {
      const days = closed
        .map((i) => (new Date(i.updated_at).getTime() - new Date(i.created_at).getTime()) / 86400000)
        .filter((d) => d >= 0);
      if (days.length) avgCycleDays = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
    }
    const totalStoryPoints = issues.reduce((s, i) => s + (i.story_points ?? 0), 0);
    const totalTimeLoggedHours = Math.round((Array.from(logMap.values()).reduce((s, m) => s + m, 0) / 60) * 10) / 10;
    return { total, open, closed: closed.length, avgCycleDays, totalStoryPoints, totalTimeLoggedHours, pctDone: total > 0 ? Math.round((closed.length / total) * 100) : 0 };
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  try {
    const issues = await fetchIssues(fromStr, toStr);
    const logMap = metric === "time_logged" ? await fetchTimeLogs(issues.map((i) => i.id)) : new Map<string, number>();

    const rows = aggregate(issues, logMap);
    const trendData = trend ? buildTrend(issues, logMap) : undefined;
    const summary = buildSummary(issues, logMap);

    let previousSummary: ReportSummary | undefined;
    let prevFrom: string | undefined;
    let prevTo: string | undefined;

    if (compare) {
      const { prevFrom: pf, prevTo: pt } = shiftDateRange(fromStr, toStr);
      prevFrom = pf;
      prevTo = pt;
      const prevIssues = await fetchIssues(pf, pt);
      const prevLogs = metric === "time_logged" ? await fetchTimeLogs(prevIssues.map((i) => i.id)) : new Map<string, number>();
      previousSummary = buildSummary(prevIssues, prevLogs);

      // If trend mode, merge previous period onto trend points
      if (trend && trendData) {
        const prevTrend = buildTrend(prevIssues, prevLogs);
        // Shift prev keys to align with current period
        const fromDate = new Date(`${fromStr}T00:00:00Z`);
        const prevFromDate = new Date(`${pf}T00:00:00Z`);
        const shiftMs = fromDate.getTime() - prevFromDate.getTime();
        const prevKeyMap = new Map(prevTrend.map((p) => {
          const shifted = new Date(new Date(p.key.includes("W") ? fromDate : prevFromDate).getTime() + shiftMs);
          const { key } = toPeriodKey(shifted, dateGroup);
          return [key, p.value];
        }));
        for (const pt of trendData) {
          pt.prevValue = prevKeyMap.get(pt.key);
        }
      }
    }

    const result: CustomReportResult = { groupBy, metric, rows, trend: trendData, summary, previousSummary, from: fromStr, to: toStr, prevFrom, prevTo };
    return NextResponse.json(result);
  } catch (e) {
    console.error("[reports/custom]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
