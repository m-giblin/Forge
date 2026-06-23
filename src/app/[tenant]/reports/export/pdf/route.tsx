import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { loadReports, type ReportsData } from "@/lib/services/reports";
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  Svg,
  Path,
  Line,
  Circle,
  StyleSheet,
} from "@react-pdf/renderer";

export const dynamic = "force-dynamic";

const P = {
  indigo:      "#6366f1",
  indigoDark:  "#4338ca",
  indigoDeep:  "#312e81",
  indigoLight: "#e0e7ff",
  green:       "#22c55e",
  greenLight:  "#dcfce7",
  amber:       "#f59e0b",
  amberLight:  "#fef3c7",
  red:         "#ef4444",
  redLight:    "#fee2e2",
  violet:      "#8b5cf6",
  slate900:    "#0f172a",
  slate700:    "#334155",
  slate500:    "#64748b",
  slate400:    "#94a3b8",
  slate200:    "#e2e8f0",
  slate100:    "#f8fafc",
  white:       "#ffffff",
};

const s = StyleSheet.create({
  page:         { fontFamily: "Helvetica", fontSize: 9, color: P.slate700, backgroundColor: P.white },
  body:         { padding: "36 48" },
  cover:        { width: "100%", height: "100%", backgroundColor: P.indigoDeep, flexDirection: "column" },
  coverTop:     { flex: 1, padding: 60, justifyContent: "flex-end" },
  coverBrand:   { fontSize: 11, color: P.indigo, fontFamily: "Helvetica-Bold", letterSpacing: 4, marginBottom: 24 },
  coverTitle:   { fontSize: 38, color: P.white, fontFamily: "Helvetica-Bold", lineHeight: 1.15, marginBottom: 16 },
  coverSub:     { fontSize: 13, color: "#a5b4fc", marginBottom: 8 },
  coverDate:    { fontSize: 10, color: "#818cf8" },
  sectionHdr:   { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionDot:   { width: 4, height: 20, backgroundColor: P.indigo, borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: P.slate900 },
  sectionSub:   { fontSize: 8, color: P.slate500, marginTop: 2 },
  kpiGrid:      { flexDirection: "row", gap: 10, marginBottom: 4 },
  kpiBox:       { flex: 1, borderRadius: 6, padding: "12 14", borderLeftWidth: 4 },
  kpiLabel:     { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 4 },
  kpiValue:     { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  kpiSub:       { fontSize: 7, color: P.slate500 },
  table:        { borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: P.slate200 },
  tableHdr:     { flexDirection: "row", backgroundColor: P.slate900, padding: "6 8" },
  tableHdrCell: { fontSize: 7, color: P.white, fontFamily: "Helvetica-Bold" },
  tableRow:     { flexDirection: "row", padding: "5 8", borderBottomWidth: 1, borderBottomColor: P.slate200 },
  tableRowAlt:  { backgroundColor: P.slate100 },
  tableCell:    { fontSize: 8, color: P.slate700 },
  barRow:       { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barLabel:     { width: 70, fontSize: 7, color: P.slate700, textAlign: "right", marginRight: 6 },
  barTrack:     { flex: 1, height: 8, backgroundColor: P.slate200, borderRadius: 4, overflow: "hidden" },
  barFill:      { height: 8, borderRadius: 4 },
  barCount:     { width: 24, fontSize: 7, color: P.slate500, textAlign: "right", marginLeft: 6 },
  cols2:        { flexDirection: "row", gap: 14 },
  col:          { flex: 1 },
  colHdr:       { fontSize: 8, fontFamily: "Helvetica-Bold", color: P.slate700, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: P.slate200 },
  footer:       { position: "absolute", bottom: 20, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between" },
  footerText:   { fontSize: 7, color: P.slate400 },
});

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={s.sectionHdr}>
      <View style={s.sectionDot} />
      <View>
        <Text style={s.sectionTitle}>{title}</Text>
        {sub && <Text style={s.sectionSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function KpiBox({ label, value, sub, color, bg, borderColor }: {
  label: string; value: string; sub: string; color: string; bg: string; borderColor: string;
}) {
  return (
    <View style={[s.kpiBox, { backgroundColor: bg, borderLeftColor: borderColor }]}>
      <Text style={[s.kpiLabel, { color }]}>{label.toUpperCase()}</Text>
      <Text style={[s.kpiValue, { color: P.slate900 }]}>{value}</Text>
      <Text style={s.kpiSub}>{sub}</Text>
    </View>
  );
}

function BarChart({ data, colors, maxVal }: {
  data: { label: string; value: number }[];
  colors: Record<string, string>;
  maxVal: number;
}) {
  return (
    <View>
      {data.map((d) => (
        <View key={d.label} style={s.barRow}>
          <Text style={s.barLabel}>{d.label}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, {
              width: `${Math.max(2, (d.value / Math.max(1, maxVal)) * 100)}%`,
              backgroundColor: colors[d.label] ?? P.indigo,
            }]} />
          </View>
          <Text style={s.barCount}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

function TrendSvg({ data, width = 440, height = 120 }: {
  data: { label: string; opened: number; closed: number }[];
  width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const pad = { t: 12, b: 20, l: 8, r: 8 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.opened, d.closed)));
  const xStep = W / Math.max(1, data.length - 1);
  const yv = (v: number) => pad.t + H - (v / maxVal) * H;
  const xv = (i: number) => pad.l + i * xStep;
  const openPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xv(i)} ${yv(d.opened)}`).join(" ");
  const closePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xv(i)} ${yv(d.closed)}`).join(" ");
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={pad.l} y1={yv(maxVal)} x2={pad.l + W} y2={yv(maxVal)} stroke={P.slate200} strokeWidth={0.5} />
      <Line x1={pad.l} y1={yv(0)}      x2={pad.l + W} y2={yv(0)}      stroke={P.slate200} strokeWidth={0.5} />
      <Path d={openPath}  stroke={P.indigo} strokeWidth={1.5} fill="none" />
      <Path d={closePath} stroke={P.green}  strokeWidth={1.5} fill="none" strokeDasharray="3 2" />
      {data.map((d, i) => (
        <React.Fragment key={i}>
          <Circle cx={xv(i)} cy={yv(d.opened)} r={2.5} fill={P.indigo} />
          <Circle cx={xv(i)} cy={yv(d.closed)} r={2.5} fill={P.green} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

function Footer({ project, date }: { project: string; date: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Forge Analytics  ·  {project}</Text>
      <Text style={s.footerText}>{date}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function ReportDoc({ data, projectName, from, to }: {
  data: ReportsData; projectName: string; from: string; to: string;
}) {
  const dateRange = `${from} – ${to}`;
  const genDate = new Date().toLocaleDateString("en-US", { dateStyle: "long" });

  const statusLabels: Record<string, string> = {
    backlog: "Backlog", todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done",
  };
  const statusColors: Record<string, string> = {
    Backlog: P.slate400, Todo: P.slate700, "In Progress": P.indigo, "In Review": P.violet, Done: P.green,
  };
  const priorityColors: Record<string, string> = {
    Urgent: P.red, High: "#fb923c", Medium: P.amber, Low: P.green,
  };
  const typeColors: Record<string, string> = {
    Bug: P.red, Feature: P.indigo, Task: P.slate500,
  };
  const totalIssues = data.byStatus.reduce((a, x) => a + x.count, 0);
  const health = data.blockedIssues.length > 0 ? "blocked"
    : data.totalOpen > data.totalDone * 2 ? "at_risk" : "good";

  return (
    <Document author="Forge" title={`${projectName} Analytics Report`} creator="Forge">

      {/* Cover */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverTop}>
          <Text style={s.coverBrand}>▣ FORGE</Text>
          <Text style={s.coverTitle}>{projectName}{"\n"}Analytics Report</Text>
          <Text style={s.coverSub}>Period: {dateRange}</Text>
          <Text style={s.coverDate}>Prepared: {genDate}</Text>
        </View>
        <View style={{ height: 8, backgroundColor: P.indigo }} />
        <View style={{ height: 2, backgroundColor: "#a5b4fc" }} />
      </Page>

      {/* Executive Summary */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={{ height: 4, backgroundColor: P.indigo, marginBottom: 28, marginHorizontal: -48 }} />
        <SectionHeader title="Executive Summary" sub={`Key metrics for ${dateRange}`} />
        <View style={[s.kpiGrid, { marginBottom: 24 }]}>
          <KpiBox label="Open Issues"      value={String(data.totalOpen)} sub="currently open"    color={P.indigo}  bg={P.indigoLight} borderColor={P.indigo} />
          <KpiBox label="Closed in Period" value={String(data.totalDone)} sub={dateRange}          color="#15803d"   bg={P.greenLight}  borderColor={P.green} />
          <KpiBox label="Avg Cycle Time"   value={data.avgCycleDays != null ? `${data.avgCycleDays}d` : "—"} sub="created → done" color="#92400e" bg={P.amberLight} borderColor={P.amber} />
          <KpiBox label="Blocked"          value={String(data.blockedIssues.length)} sub={`${data.blockedDaysTotal} blocked-days`} color="#991b1b" bg={P.redLight} borderColor={P.red} />
        </View>
        <View style={{
          backgroundColor: health === "blocked" ? P.redLight : health === "at_risk" ? P.amberLight : P.greenLight,
          borderRadius: 6, padding: "10 14", marginBottom: 24,
          borderLeftWidth: 4,
          borderLeftColor: health === "blocked" ? P.red : health === "at_risk" ? P.amber : P.green,
        }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: P.slate900, marginBottom: 3 }}>
            {health === "blocked" ? "⚠  Action Required — Blocked Issues Detected"
             : health === "at_risk" ? "⚡  Attention — High Open Issue Backlog"
             : "✓  Project Health is Good"}
          </Text>
          <Text style={{ fontSize: 7.5, color: P.slate700, lineHeight: 1.5 }}>
            {health === "blocked"
              ? `${data.blockedIssues.length} issue${data.blockedIssues.length > 1 ? "s are" : " is"} blocked with ${data.blockedDaysTotal} combined blocked-days.`
              : `${data.totalOpen} open, ${data.totalDone} closed. Avg cycle: ${data.avgCycleDays != null ? `${data.avgCycleDays}d` : "n/a"}.`}
          </Text>
        </View>
        <View style={s.cols2}>
          <View style={s.col}>
            <Text style={s.colHdr}>Issues by Status</Text>
            <BarChart
              data={data.byStatus.map((st) => ({ label: statusLabels[st.status] ?? st.status, value: st.count }))}
              colors={statusColors}
              maxVal={Math.max(1, ...data.byStatus.map((st) => st.count))}
            />
          </View>
          <View style={s.col}>
            <Text style={s.colHdr}>Issues by Priority</Text>
            <BarChart
              data={data.byPriority.map((p) => ({ label: p.priority.charAt(0).toUpperCase() + p.priority.slice(1), value: p.count }))}
              colors={priorityColors}
              maxVal={Math.max(1, ...data.byPriority.map((p) => p.count))}
            />
          </View>
        </View>
        <Footer project={projectName} date={genDate} />
      </Page>

      {/* Trend Analysis */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={{ height: 4, backgroundColor: P.indigo, marginBottom: 28, marginHorizontal: -48 }} />
        <SectionHeader title="Issue Trends" sub="Weekly opened vs. closed — velocity insight" />
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 16, height: 2, backgroundColor: P.indigo }} />
            <Text style={{ fontSize: 7.5, color: P.slate700 }}>Opened</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 16, height: 2, backgroundColor: P.green }} />
            <Text style={{ fontSize: 7.5, color: P.slate700 }}>Closed</Text>
          </View>
        </View>
        {data.weeklyTrend.length >= 2
          ? <TrendSvg data={data.weeklyTrend.slice(-12)} width={460} height={130} />
          : <View style={{ height: 80, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 9, color: P.slate400 }}>Not enough data to render trend chart</Text>
            </View>
        }
        <View style={{ marginTop: 24 }} />
        <SectionHeader title="Issue Type Breakdown" sub="Bug vs Feature vs Task distribution" />
        <View style={[s.table, { marginBottom: 20 }]}>
          <View style={s.tableHdr}>
            <Text style={[s.tableHdrCell, { flex: 2 }]}>Type</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Count</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Share</Text>
          </View>
          {data.byType.map((t, i) => {
            const lbl = t.type.charAt(0).toUpperCase() + t.type.slice(1);
            return (
              <View key={t.type} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeColors[lbl] ?? P.indigo }} />
                  <Text style={s.tableCell}>{lbl}</Text>
                </View>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{t.count}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{Math.round((t.count / Math.max(1, totalIssues)) * 100)}%</Text>
              </View>
            );
          })}
        </View>
        {data.avgCycleDays != null && (
          <View>
            <SectionHeader title="Cycle Time" sub="Average time from creation to completion" />
            <View style={{ flexDirection: "row", gap: 14, backgroundColor: P.amberLight, borderRadius: 6, padding: "12 16" }}>
              <View>
                <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: P.slate900 }}>{data.avgCycleDays}d</Text>
                <Text style={{ fontSize: 8, color: P.slate500 }}>Average issue cycle</Text>
              </View>
              <View style={{ flex: 1, justifyContent: "center" }}>
                {data.cycleByStage.map((cs) => (
                  <View key={cs.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 7.5, color: P.slate700 }}>{cs.label}</Text>
                    <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: P.amber }}>{cs.avgDays}d</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
        <Footer project={projectName} date={genDate} />
      </Page>

      {/* Team & Blockers */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={{ height: 4, backgroundColor: P.indigo, marginBottom: 28, marginHorizontal: -48 }} />
        <SectionHeader title="Team Workload" sub="Open issues by assignee" />
        <View style={[s.table, { marginBottom: 24 }]}>
          <View style={s.tableHdr}>
            <Text style={[s.tableHdrCell, { flex: 3 }]}>Assignee</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "center" }]}>Open</Text>
            <Text style={[s.tableHdrCell, { flex: 2 }]}>Workload</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Share</Text>
          </View>
          {data.byAssignee.slice(0, 12).map((a, i) => {
            const tot = data.byAssignee.reduce((sum, x) => sum + x.count, 0);
            const pct = (a.count / Math.max(1, tot)) * 100;
            return (
              <View key={a.name} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.tableCell, { flex: 3, fontFamily: a.assigneeId ? "Helvetica" : "Helvetica-Bold" }]}>{a.name}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "center", fontFamily: "Helvetica-Bold", color: P.indigo }]}>{a.count}</Text>
                <View style={{ flex: 2, paddingVertical: 4 }}>
                  <View style={{ height: 6, backgroundColor: P.slate200, borderRadius: 3 }}>
                    <View style={{ width: `${pct}%`, height: 6, backgroundColor: P.indigo, borderRadius: 3 }} />
                  </View>
                </View>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{Math.round(pct)}%</Text>
              </View>
            );
          })}
        </View>
        {data.blockedIssues.length > 0 && (
          <View>
            <SectionHeader title="Blockers" sub="Issues requiring immediate attention" />
            <View style={s.table}>
              <View style={[s.tableHdr, { backgroundColor: P.red }]}>
                <Text style={[s.tableHdrCell, { flex: 1 }]}>Key</Text>
                <Text style={[s.tableHdrCell, { flex: 4 }]}>Issue</Text>
                <Text style={[s.tableHdrCell, { flex: 2 }]}>Assignee</Text>
                <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Days</Text>
              </View>
              {data.blockedIssues.sort((a, b) => b.daysOld - a.daysOld).slice(0, 15).map((b, i) => (
                <View key={b.id} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: P.redLight } : {}]}>
                  <Text style={[s.tableCell, { flex: 1, fontFamily: "Helvetica-Bold" }]}>{b.key}</Text>
                  <Text style={[s.tableCell, { flex: 4 }]}>{b.title.length > 55 ? b.title.slice(0, 55) + "…" : b.title}</Text>
                  <Text style={[s.tableCell, { flex: 2 }]}>{b.assigneeName}</Text>
                  <Text style={[s.tableCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold", color: P.red }]}>{b.daysOld}d</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <Footer project={projectName} date={genDate} />
      </Page>

    </Document>
  );
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

  const fromStr = from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const toStr   = to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const buffer = await renderToBuffer(
    <ReportDoc data={data} projectName={projectName} from={fromStr} to={toStr} />,
  );

  const filename = `forge-report-${projectName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
