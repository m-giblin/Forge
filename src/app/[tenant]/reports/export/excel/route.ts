import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { loadReports } from "@/lib/services/reports";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

// Forge brand colours (ARGB for ExcelJS)
const C = {
  indigo:      "FF6366F1",
  indigoDark:  "FF4338CA",
  indigoLight: "FFE0E7FF",
  green:       "FF22C55E",
  greenLight:  "FFDCFCE7",
  amber:       "FFF59E0B",
  amberLight:  "FFFEF3C7",
  red:         "FFEF4444",
  redLight:    "FFFEE2E2",
  slate900:    "FF0F172A",
  slate700:    "FF334155",
  slate500:    "FF64748B",
  slate200:    "FFE2E8F0",
  slate100:    "FFF8FAFC",
  white:       "FFFFFFFF",
  violet:      "FF8B5CF6",
  sky:         "FF0EA5E9",
} as const;

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}
function border(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: "thin", color: { argb: C.slate200 } };
  return { top: s, bottom: s, left: s, right: s };
}
function thickBorder(argb: string): Partial<ExcelJS.Borders> {
  const t: Partial<ExcelJS.Border> = { style: "medium", color: { argb } };
  const s: Partial<ExcelJS.Border> = { style: "thin", color: { argb: C.slate200 } };
  return { top: t, bottom: s, left: t, right: s };
}

function hdr(ws: ExcelJS.Worksheet, row: number, col: number, value: string, argb: string = C.indigo) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.fill = solid(argb);
  cell.font = { color: { argb: C.white }, bold: true, size: 10, name: "Calibri" };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = border();
}

function kpi(
  ws: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  label: string,
  value: string | number,
  sub: string,
  bgArgb: string,
  accentArgb: string,
) {
  // Merge 3 rows × 3 cols for the KPI tile
  ws.mergeCells(startRow, startCol, startRow + 2, startCol + 2);
  const top = ws.getCell(startRow, startCol);
  top.fill = solid(bgArgb);

  // label row
  ws.getCell(startRow, startCol).value = label;
  ws.getCell(startRow, startCol).font = { color: { argb: accentArgb }, bold: true, size: 8, name: "Calibri" };
  ws.getCell(startRow, startCol).alignment = { horizontal: "left", vertical: "top", wrapText: true };

  // unmerge and do it properly with separate rows
  // ExcelJS merge means only top-left cell gets value, so we use separate rows
  ws.unMergeCells(startRow, startCol, startRow + 2, startCol + 2);

  const r1 = ws.getCell(startRow, startCol);
  r1.value = label.toUpperCase();
  r1.fill = solid(bgArgb);
  r1.font = { color: { argb: accentArgb }, bold: true, size: 7.5, name: "Calibri" };
  r1.alignment = { horizontal: "left", vertical: "middle" };
  r1.border = { left: { style: "thick", color: { argb: accentArgb } } };

  const r2 = ws.getCell(startRow + 1, startCol);
  r2.value = value;
  r2.fill = solid(bgArgb);
  r2.font = { color: { argb: C.slate900 }, bold: true, size: 20, name: "Calibri" };
  r2.alignment = { horizontal: "left", vertical: "middle" };
  r2.border = { left: { style: "thick", color: { argb: accentArgb } } };

  const r3 = ws.getCell(startRow + 2, startCol);
  r3.value = sub;
  r3.fill = solid(bgArgb);
  r3.font = { color: { argb: C.slate500 }, size: 8, name: "Calibri" };
  r3.alignment = { horizontal: "left", vertical: "middle" };
  r3.border = { left: { style: "thick", color: { argb: accentArgb } }, bottom: { style: "thin", color: { argb: C.slate200 } } };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const defaultFrom = new Date(now); defaultFrom.setDate(defaultFrom.getDate() - 30);
  const from = sp.get("from") ? new Date(sp.get("from")!) : defaultFrom;
  const to   = sp.get("to")   ? new Date(sp.get("to")!)   : now;
  const projectId = sp.get("project") ?? null;

  const data = await loadReports(ctx.tenant.id, from, to, projectId, ctx.impersonating);
  const projectName = projectId
    ? (data.projects.find((p) => p.id === projectId)?.name ?? "All Projects")
    : "All Projects";
  const dateRange = `${from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Forge";
  wb.created = new Date();

  // ── Sheet 1: Executive Dashboard ────────────────────────────────────────
  const dash = wb.addWorksheet("Executive Dashboard", {
    properties: { tabColor: { argb: C.indigo } },
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  dash.columns = [
    { width: 2 },   // A — gutter
    { width: 16 },  // B
    { width: 16 },  // C
    { width: 16 },  // D
    { width: 2 },   // E — gutter
    { width: 16 },  // F
    { width: 16 },  // G
    { width: 16 },  // H
    { width: 2 },   // I — gutter
    { width: 16 },  // J
    { width: 16 },  // K
    { width: 16 },  // L
    { width: 2 },   // M — gutter
    { width: 16 },  // N
    { width: 16 },  // O
    { width: 16 },  // P
  ];

  // ── Title banner (rows 1-3) ──
  dash.mergeCells("A1:P3");
  const title = dash.getCell("A1");
  title.value = `  FORGE  ·  ${projectName.toUpperCase()}  ·  PROJECT ANALYTICS REPORT`;
  title.fill = solid(C.indigoDark);
  title.font = { color: { argb: C.white }, bold: true, size: 16, name: "Calibri" };
  title.alignment = { vertical: "middle", horizontal: "left" };
  dash.getRow(1).height = 12;
  dash.getRow(2).height = 28;
  dash.getRow(3).height = 12;

  // ── Subtitle row (row 4) ──
  dash.mergeCells("A4:P4");
  const sub = dash.getCell("A4");
  sub.value = `  Report Period: ${dateRange}   ·   Generated: ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`;
  sub.fill = solid(C.indigo);
  sub.font = { color: { argb: "FFBFDBFE" }, size: 9, name: "Calibri" };
  sub.alignment = { vertical: "middle", horizontal: "left" };
  dash.getRow(4).height = 18;

  dash.getRow(5).height = 8; // spacer

  // ── KPI tiles (rows 6-8) ──
  // Col B-D: Open Issues (blue)
  kpi(dash, 6, 2, "Open Issues", data.totalOpen, "currently open", C.indigoLight, C.indigo);
  // Col F-H: Closed (green)
  kpi(dash, 6, 6, "Closed in Period", data.totalDone, `${dateRange}`, C.greenLight, C.green);
  // Col J-L: Avg Cycle (amber)
  kpi(dash, 6, 10, "Avg Cycle Time", data.avgCycleDays != null ? `${data.avgCycleDays}d` : "—", "created → done", C.amberLight, C.amber);
  // Col N-P: Blocked (red)
  kpi(dash, 6, 14, "Blocked Issues", data.blockedIssues.length, `${data.blockedDaysTotal} total blocked-days`, C.redLight, C.red);
  dash.getRow(6).height = 16; dash.getRow(7).height = 26; dash.getRow(8).height = 16;

  dash.getRow(9).height = 10; // spacer

  // ── Status Breakdown (rows 10-) ──
  const statusColors: Record<string, string> = {
    backlog: C.slate500, todo: C.slate700, in_progress: C.indigo, in_review: C.violet, done: C.green,
  };
  const statusLabels: Record<string, string> = {
    backlog: "Backlog", todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done",
  };

  hdr(dash, 10, 2, "STATUS BREAKDOWN", C.slate900);
  dash.mergeCells(10, 2, 10, 4);
  dash.getCell(10, 2).font = { color: { argb: C.white }, bold: true, size: 9, name: "Calibri" };
  dash.getRow(10).height = 18;

  const maxStatus = Math.max(1, ...data.byStatus.map((s) => s.count));
  data.byStatus.forEach((s, i) => {
    const r = 11 + i;
    const label = dash.getCell(r, 2);
    label.value = statusLabels[s.status] ?? s.status;
    label.font = { size: 9, name: "Calibri", bold: true };
    label.fill = solid(C.slate100);
    label.border = border();
    label.alignment = { horizontal: "right", vertical: "middle" };

    const bar = dash.getCell(r, 3);
    const pct = (s.count / maxStatus) * 100;
    bar.value = `${"█".repeat(Math.max(1, Math.round(pct / 7)))}  ${s.count}`;
    bar.font = { color: { argb: statusColors[s.status] ?? C.indigo }, size: 9, name: "Calibri", bold: true };
    bar.fill = solid(C.slate100);
    bar.border = border();

    const pctCell = dash.getCell(r, 4);
    pctCell.value = s.count / Math.max(1, data.byStatus.reduce((a, x) => a + x.count, 0));
    pctCell.numFmt = "0%";
    pctCell.font = { size: 9, name: "Calibri" };
    pctCell.fill = solid(C.slate100);
    pctCell.border = border();
    pctCell.alignment = { horizontal: "right" };
    dash.getRow(r).height = 16;
  });

  // ── Priority Breakdown ──
  const priColors: Record<string, string> = {
    urgent: C.red, high: "FFFB923C", medium: C.amber, low: C.green,
  };
  const startPri = 10;
  hdr(dash, startPri, 6, "PRIORITY BREAKDOWN", C.slate900);
  dash.mergeCells(startPri, 6, startPri, 8);
  dash.getCell(startPri, 6).font = { color: { argb: C.white }, bold: true, size: 9, name: "Calibri" };

  const maxPri = Math.max(1, ...data.byPriority.map((p) => p.count));
  data.byPriority.forEach((p, i) => {
    const r = 11 + i;
    const label = dash.getCell(r, 6);
    label.value = p.priority.charAt(0).toUpperCase() + p.priority.slice(1);
    label.font = { size: 9, name: "Calibri", bold: true };
    label.fill = solid(C.slate100); label.border = border();
    label.alignment = { horizontal: "right", vertical: "middle" };

    const bar = dash.getCell(r, 7);
    const pct = (p.count / maxPri) * 100;
    bar.value = `${"█".repeat(Math.max(1, Math.round(pct / 7)))}  ${p.count}`;
    bar.font = { color: { argb: priColors[p.priority] ?? C.indigo }, size: 9, name: "Calibri", bold: true };
    bar.fill = solid(C.slate100); bar.border = border();

    const pctCell = dash.getCell(r, 8);
    pctCell.value = p.count / Math.max(1, data.byPriority.reduce((a, x) => a + x.count, 0));
    pctCell.numFmt = "0%";
    pctCell.font = { size: 9, name: "Calibri" };
    pctCell.fill = solid(C.slate100); pctCell.border = border();
    pctCell.alignment = { horizontal: "right" };
    dash.getRow(r).height = 16;
  });

  // ── Type Breakdown ──
  const typeColors: Record<string, string> = { bug: C.red, feature: C.indigo, task: C.slate500 };
  hdr(dash, startPri, 10, "ISSUE TYPE", C.slate900);
  dash.mergeCells(startPri, 10, startPri, 12);
  dash.getCell(startPri, 10).font = { color: { argb: C.white }, bold: true, size: 9, name: "Calibri" };

  const maxType = Math.max(1, ...data.byType.map((t) => t.count));
  data.byType.forEach((t, i) => {
    const r = 11 + i;
    const label = dash.getCell(r, 10);
    label.value = t.type.charAt(0).toUpperCase() + t.type.slice(1);
    label.font = { size: 9, name: "Calibri", bold: true };
    label.fill = solid(C.slate100); label.border = border();
    label.alignment = { horizontal: "right", vertical: "middle" };

    const bar = dash.getCell(r, 11);
    const pct = (t.count / maxType) * 100;
    bar.value = `${"█".repeat(Math.max(1, Math.round(pct / 7)))}  ${t.count}`;
    bar.font = { color: { argb: typeColors[t.type] ?? C.indigo }, size: 9, name: "Calibri", bold: true };
    bar.fill = solid(C.slate100); bar.border = border();

    const pctCell = dash.getCell(r, 12);
    pctCell.value = t.count / Math.max(1, data.byType.reduce((a, x) => a + x.count, 0));
    pctCell.numFmt = "0%"; pctCell.font = { size: 9, name: "Calibri" };
    pctCell.fill = solid(C.slate100); pctCell.border = border();
    pctCell.alignment = { horizontal: "right" };
    dash.getRow(r).height = 16;
  });

  // ── Weekly Trend table ──
  hdr(dash, startPri, 14, "WEEKLY TREND", C.slate900);
  dash.mergeCells(startPri, 14, startPri, 16);
  dash.getCell(startPri, 14).font = { color: { argb: C.white }, bold: true, size: 9, name: "Calibri" };

  hdr(dash, 11, 14, "Week", C.slate700); hdr(dash, 11, 15, "Opened", C.indigo); hdr(dash, 11, 16, "Closed", C.green);
  data.weeklyTrend.slice(-8).forEach((w, i) => {
    const r = 12 + i;
    const wCell = dash.getCell(r, 14);
    wCell.value = w.label; wCell.font = { size: 9, name: "Calibri" };
    wCell.fill = solid(i % 2 === 0 ? C.slate100 : C.white); wCell.border = border();
    wCell.alignment = { horizontal: "center" };

    const o = dash.getCell(r, 15);
    o.value = w.opened; o.font = { size: 9, name: "Calibri", bold: true, color: { argb: C.indigo } };
    o.fill = solid(i % 2 === 0 ? C.slate100 : C.white); o.border = border(); o.alignment = { horizontal: "center" };

    const c = dash.getCell(r, 16);
    c.value = w.closed; c.font = { size: 9, name: "Calibri", bold: true, color: { argb: C.green } };
    c.fill = solid(i % 2 === 0 ? C.slate100 : C.white); c.border = border(); c.alignment = { horizontal: "center" };
    dash.getRow(r).height = 15;
  });

  // ── Assignee Workload (Team) ──
  const teamStartRow = Math.max(20, 12 + data.byStatus.length + 2);
  dash.mergeCells(teamStartRow, 2, teamStartRow, 16);
  const teamHdr = dash.getCell(teamStartRow, 2);
  teamHdr.value = "TEAM WORKLOAD — OPEN ISSUES BY ASSIGNEE";
  teamHdr.fill = solid(C.slate900);
  teamHdr.font = { color: { argb: C.white }, bold: true, size: 9, name: "Calibri" };
  teamHdr.alignment = { vertical: "middle", horizontal: "left" };
  dash.getRow(teamStartRow).height = 18;

  const teamColW = 14;
  hdr(dash, teamStartRow + 1, 2, "Assignee", C.slate700);
  hdr(dash, teamStartRow + 1, 3, "Open Issues", C.indigo);
  hdr(dash, teamStartRow + 1, 4, "Workload %", C.indigo);
  dash.mergeCells(teamStartRow + 1, 2, teamStartRow + 1, 2);
  dash.getRow(teamStartRow + 1).height = 16;

  const totalAssignee = data.byAssignee.reduce((a, x) => a + x.count, 0);
  data.byAssignee.slice(0, 10).forEach((a, i) => {
    const r = teamStartRow + 2 + i;
    const bg = i % 2 === 0 ? C.slate100 : C.white;

    const nameCell = dash.getCell(r, 2);
    nameCell.value = a.name; nameCell.font = { size: 9, name: "Calibri", bold: !a.assigneeId };
    nameCell.fill = solid(bg); nameCell.border = border();

    const countCell = dash.getCell(r, 3);
    countCell.value = a.count; countCell.font = { size: 9, name: "Calibri", bold: true, color: { argb: C.indigo } };
    countCell.fill = solid(bg); countCell.border = border(); countCell.alignment = { horizontal: "center" };

    const pctCell = dash.getCell(r, 4);
    pctCell.value = a.count / Math.max(1, totalAssignee);
    pctCell.numFmt = "0%"; pctCell.font = { size: 9, name: "Calibri" };
    pctCell.fill = solid(bg); pctCell.border = border(); pctCell.alignment = { horizontal: "right" };
    dash.getRow(r).height = 15;
  });

  // ── Footer ──
  const footerRow = teamStartRow + 2 + data.byAssignee.length + 1;
  dash.mergeCells(footerRow, 2, footerRow, 16);
  const footer = dash.getCell(footerRow, 2);
  footer.value = `Generated by Forge  ·  forge.app  ·  ${new Date().toISOString().slice(0, 10)}`;
  footer.fill = solid(C.slate100);
  footer.font = { color: { argb: C.slate500 }, size: 8, italic: true, name: "Calibri" };
  footer.alignment = { horizontal: "center", vertical: "middle" };
  dash.getRow(footerRow).height = 16;

  // ── Sheet 2: Full Issues Data ────────────────────────────────────────────
  const issueSheet = wb.addWorksheet("Issue Data", {
    properties: { tabColor: { argb: C.slate500 } },
  });
  issueSheet.columns = [
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Type", key: "type", width: 10 },
    { header: "Assignee", key: "assignee", width: 20 },
    { header: "Opened (week)", key: "week", width: 12 },
    { header: "Count", key: "count", width: 8 },
  ];
  const ihdr = issueSheet.getRow(1);
  ihdr.eachCell((cell) => {
    cell.fill = solid(C.slate900);
    cell.font = { color: { argb: C.white }, bold: true, size: 9, name: "Calibri" };
    cell.border = border();
  });
  ihdr.height = 18;

  // Status rows
  data.byStatus.forEach((s, i) => {
    const r = issueSheet.addRow({ status: statusLabels[s.status] ?? s.status, priority: "", type: "", assignee: "", week: "", count: s.count });
    r.getCell("status").fill = solid(i % 2 === 0 ? C.slate100 : C.white);
    r.getCell("count").font = { bold: true, color: { argb: statusColors[s.status] ?? C.indigo } };
    r.height = 15;
  });

  // Weekly rows
  data.weeklyTrend.forEach((w, i) => {
    const r = issueSheet.addRow({ status: "", priority: "", type: "", assignee: "", week: w.label, count: w.opened });
    r.height = 15;
  });

  // ── Sheet 3: Blockers ───────────────────────────────────────────────────
  if (data.blockedIssues.length > 0) {
    const blockerSheet = wb.addWorksheet("Blockers", {
      properties: { tabColor: { argb: C.red } },
    });
    blockerSheet.columns = [
      { header: "Issue Key", key: "key", width: 12 },
      { header: "Title", key: "title", width: 40 },
      { header: "Assignee", key: "assignee", width: 20 },
      { header: "Days Blocked", key: "days", width: 14 },
    ];
    const bh = blockerSheet.getRow(1);
    bh.eachCell((cell) => {
      cell.fill = solid(C.red);
      cell.font = { color: { argb: C.white }, bold: true, size: 9, name: "Calibri" };
      cell.border = border();
    });
    bh.height = 18;

    data.blockedIssues.sort((a, b) => b.daysOld - a.daysOld).forEach((b, i) => {
      const r = blockerSheet.addRow({ key: b.key, title: b.title, assignee: b.assigneeName, days: b.daysOld });
      const bg = i % 2 === 0 ? C.redLight : C.white;
      r.eachCell((cell) => { cell.fill = solid(bg); cell.font = { size: 9, name: "Calibri" }; cell.border = border(); });
      r.getCell("days").font = { size: 9, name: "Calibri", bold: true, color: { argb: C.red } };
      r.height = 15;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const filename = `forge-report-${projectName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
