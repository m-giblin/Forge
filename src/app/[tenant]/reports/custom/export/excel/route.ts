import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import ExcelJS from "exceljs";
import type { GroupBy, Metric, DateGroup } from "@/app/api/reports/custom/route";

export const dynamic = "force-dynamic";

const VALID_GROUP_BY = ["status", "priority", "type", "assignee", "label", "sprint", "phase", "environment"];
const VALID_METRICS = ["count", "story_points", "time_logged"];
const CLOSED_STATUSES = new Set(["done", "closed"]);

function dimLabel(dim: string) { return dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

// eslint-disable-next-line no-restricted-imports -- service-role required
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const rawGroupBy = sp.get("groupBy") ?? "status";
  const groupBy: GroupBy = VALID_GROUP_BY.includes(rawGroupBy) ? rawGroupBy as GroupBy : "status";
  const rawMetric = sp.get("metric") ?? "count";
  const metric: Metric = VALID_METRICS.includes(rawMetric) ? rawMetric as Metric : "count";
  const trend = sp.get("trend") === "true";
  const rawDG = sp.get("dateGroup") ?? "week";
  const dateGroup: DateGroup = ["week", "month"].includes(rawDG) ? rawDG as DateGroup : "week";
  const projectId = sp.get("project") || null;
  const now = new Date();
  const defaultFrom = new Date(now); defaultFrom.setDate(defaultFrom.getDate() - 30);
  const fromStr = sp.get("from") ?? defaultFrom.toISOString().slice(0, 10);
  const toStr = sp.get("to") ?? now.toISOString().slice(0, 10);

  const svc = createSupabaseServiceClient();

  // Fetch sprint names
  const sprintMap = new Map<string, string>();
  if (groupBy === "sprint") {
    const { data } = await svc.from("sprints").select("id, name").eq("tenant_id", ctx.tenant.id);
    (data ?? []).forEach((s) => sprintMap.set(s.id as string, s.name as string));
  }

  let q = svc.from("issues")
    .select("id, status, priority, type, assignee_id, labels, sprint_id, phase, environment, story_points, created_at, updated_at, users!issues_assignee_id_fkey(email)")
    .eq("tenant_id", ctx.tenant.id)
    .gte("created_at", `${fromStr}T00:00:00Z`)
    .lte("created_at", `${toStr}T23:59:59Z`);
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type IssueRow = { id: string; status: string; priority: string; type: string; assignee_email: string | null; labels: string[] | null; sprint_id: string | null; phase: string | null; environment: string | null; story_points: number | null; created_at: string };
  const issues: IssueRow[] = ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    const userObj = r.users;
    const email = Array.isArray(userObj) ? (userObj[0]?.email ?? null) : ((userObj as Record<string, unknown> | null)?.email ?? null);
    return { id: r.id as string, status: r.status as string, priority: r.priority as string, type: r.type as string, assignee_email: email as string | null, labels: r.labels as string[] | null, sprint_id: r.sprint_id as string | null, phase: r.phase as string | null, environment: r.environment as string | null, story_points: r.story_points as number | null, created_at: r.created_at as string };
  });

  // Time logs if needed
  const logMap = new Map<string, number>();
  if (metric === "time_logged") {
    const ids = issues.map((i) => i.id as string);
    if (ids.length > 0) {
      const { data: logs } = await svc.from("issue_time_logs").select("issue_id, minutes").eq("tenant_id", ctx.tenant.id).in("issue_id", ids);
      for (const l of logs ?? []) logMap.set(l.issue_id as string, (logMap.get(l.issue_id as string) ?? 0) + (l.minutes as number));
    }
  }

  function getDimensions(issue: Record<string, unknown>): string[] {
    switch (groupBy) {
      case "status": return [(issue.status as string) || "unknown"];
      case "priority": return [(issue.priority as string) || "none"];
      case "type": return [(issue.type as string) || "task"];
      case "assignee": return [(issue.assignee_email as string | null) ?? "Unassigned"];
      case "label": { const ls = issue.labels as string[] | null; return ls && ls.length > 0 ? ls : ["Unlabeled"]; }
      case "sprint": return [issue.sprint_id ? (sprintMap.get(issue.sprint_id as string) ?? "Unknown Sprint") : "Backlog"];
      case "phase": return [(issue.phase as string) || "No Phase"];
      case "environment": return [(issue.environment as string) || "Not Set"];
      default: return ["unknown"];
    }
  }

  function getVal(issue: Record<string, unknown>): number {
    if (metric === "count") return 1;
    if (metric === "story_points") return (issue.story_points as number | null) ?? 0;
    return (logMap.get(issue.id as string) ?? 0) / 60;
  }

  const aggMap = new Map<string, { value: number; open: number; closed: number }>();
  for (const issue of issues) {
    const dims = getDimensions(issue);
    const val = getVal(issue);
    const done = CLOSED_STATUSES.has(issue.status as string);
    for (const dim of dims) {
      const e = aggMap.get(dim) ?? { value: 0, open: 0, closed: 0 };
      e.value += val; if (done) e.closed += val; else e.open += val;
      aggMap.set(dim, e);
    }
  }
  const rows = Array.from(aggMap.entries())
    .map(([dim, s]) => ({ dim, value: Math.round(s.value * 100) / 100, open: Math.round(s.open * 100) / 100, closed: Math.round(s.closed * 100) / 100, pctDone: s.value > 0 ? Math.round((s.closed / s.value) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Forge"; wb.created = now;

  // ── Sheet 1: Report ────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Custom Report", { properties: { tabColor: { argb: "FF6366F1" } } });
  ws.columns = [
    { key: "dim", width: 28 },
    { key: "value", width: 14 },
    { key: "open", width: 12 },
    { key: "closed", width: 12 },
    { key: "pctDone", width: 12 },
    { key: "bar", width: 30 },
  ];

  // Title block
  ws.mergeCells("A1:F1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `Custom Report · ${groupBy.toUpperCase()} breakdown · ${metric}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF312E81" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `Period: ${fromStr} → ${toStr} · Generated ${now.toLocaleDateString()}`;
  ws.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF6B7280" } };

  // Header
  const hdr = ws.getRow(4);
  const metricLabel = metric === "count" ? "Count" : metric === "story_points" ? "Story Points" : "Hours Logged";
  ["Dimension", metricLabel, "Open", "Done", "% Done", "Bar"].forEach((h, i) => {
    const cell = hdr.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF6366F1" } } };
  });
  hdr.height = 24;

  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  rows.forEach((row, i) => {
    const r = ws.getRow(i + 5);
    const isAlt = i % 2 === 1;
    const bgColor = isAlt ? "FFF8FAFC" : "FFFFFFFF";
    const barLen = Math.round((row.value / maxVal) * 20);
    r.getCell(1).value = dimLabel(row.dim);
    r.getCell(2).value = Math.round(row.value * 100) / 100;
    r.getCell(3).value = Math.round(row.open * 100) / 100;
    r.getCell(4).value = Math.round(row.closed * 100) / 100;
    r.getCell(5).value = row.pctDone / 100;
    r.getCell(6).value = "█".repeat(barLen);
    [1,2,3,4,5,6].forEach((col) => {
      r.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      r.getCell(col).alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "center" };
    });
    r.getCell(2).font = { bold: true };
    r.getCell(4).font = { color: { argb: "FF15803D" } };
    r.getCell(3).font = { color: { argb: "FF4F46E5" } };
    r.getCell(5).numFmt = "0%";
    r.getCell(6).font = { color: { argb: "FF6366F1" } };
    r.height = 20;
  });

  // Summary row
  const sumRow = ws.getRow(rows.length + 6);
  sumRow.getCell(1).value = "TOTAL";
  sumRow.getCell(2).value = rows.reduce((s, r) => s + r.value, 0);
  sumRow.getCell(3).value = rows.reduce((s, r) => s + r.open, 0);
  sumRow.getCell(4).value = rows.reduce((s, r) => s + r.closed, 0);
  [1,2,3,4].forEach((col) => {
    sumRow.getCell(col).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sumRow.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
    sumRow.getCell(col).alignment = { horizontal: "center", vertical: "middle" };
  });
  sumRow.height = 22;

  // ── Sheet 2: Raw Data ──────────────────────────────────────────────────────
  if (!trend) {
    const ws2 = wb.addWorksheet("All Issues", { properties: { tabColor: { argb: "FF64748B" } } });
    ws2.columns = [
      { key: "status", header: "Status", width: 14 },
      { key: "priority", header: "Priority", width: 12 },
      { key: "type", header: "Type", width: 12 },
      { key: "assignee", header: "Assignee", width: 24 },
      { key: "points", header: "Story Points", width: 14 },
      { key: "created", header: "Created", width: 14 },
    ];
    const hdrRow = ws2.getRow(1);
    hdrRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    });
    hdrRow.height = 20;
    issues.forEach((issue) => {
      ws2.addRow({
        status: issue.status, priority: issue.priority, type: issue.type,
        assignee: (issue.assignee_email as string | null) ?? "Unassigned",
        points: issue.story_points ?? 0,
        created: new Date(issue.created_at as string).toLocaleDateString(),
      });
    });
  }

  const filename = `forge-custom-report-${groupBy}-${fromStr}-${toStr}.xlsx`;
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
