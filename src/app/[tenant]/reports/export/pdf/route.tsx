import React from "react";
import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { loadReports, type ReportsData } from "@/lib/services/reports";
import { projectsRepo } from "@/lib/repositories/projects";
import type { Project } from "@/lib/repositories/projects";
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

// ── Palette ───────────────────────────────────────────────────────────────────
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
  slate800:    "#1e293b",
  slate700:    "#334155",
  slate600:    "#475569",
  slate500:    "#64748b",
  slate400:    "#94a3b8",
  slate300:    "#cbd5e1",
  slate200:    "#e2e8f0",
  slate100:    "#f8fafc",
  white:       "#ffffff",
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:         { fontFamily: "Helvetica", fontSize: 9, color: P.slate700, backgroundColor: P.white },
  body:         { padding: "40 52" },
  // Cover
  cover:        { width: "100%", height: "100%", backgroundColor: P.indigoDeep, flexDirection: "column" },
  coverTop:     { flex: 1, padding: "60 64", justifyContent: "flex-end" },
  coverBrand:   { fontSize: 10, color: P.indigo, fontFamily: "Helvetica-Bold", letterSpacing: 5, marginBottom: 32 },
  coverTitle:   { fontSize: 36, color: P.white, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 20 },
  coverSub:     { fontSize: 12, color: "#a5b4fc", marginBottom: 10 },
  coverDate:    { fontSize: 9, color: "#818cf8" },
  // TOC
  tocRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.slate200 },
  tocNum:       { width: 28, fontSize: 8, color: P.indigo, fontFamily: "Helvetica-Bold", textAlign: "right", marginRight: 12 },
  tocTitle:     { flex: 1, fontSize: 10, color: P.slate800, fontFamily: "Helvetica-Bold" },
  tocSub:       { fontSize: 8, color: P.slate500, marginTop: 2 },
  tocPage:      { width: 24, fontSize: 9, color: P.slate500, textAlign: "right", fontFamily: "Helvetica-Bold" },
  tocDots:      { flex: 1, borderBottomWidth: 1, borderBottomColor: P.slate300, borderBottomStyle: "dashed", marginHorizontal: 8, marginBottom: 4 },
  // Section header
  sectionHdr:   { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionDot:   { width: 4, height: 22, backgroundColor: P.indigo, borderRadius: 2, marginRight: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: P.slate900 },
  sectionSub:   { fontSize: 8.5, color: P.slate500, marginTop: 3 },
  // Chart explanation callout
  chartNote:    { backgroundColor: P.slate100, borderRadius: 5, padding: "8 12", marginBottom: 12, borderLeftWidth: 3, borderLeftColor: P.indigo },
  chartNoteHdr: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: P.indigo, marginBottom: 3 },
  chartNoteBody:{ fontSize: 7.5, color: P.slate600, lineHeight: 1.55 },
  // KPI
  kpiGrid:      { flexDirection: "row", gap: 10, marginBottom: 4 },
  kpiBox:       { flex: 1, borderRadius: 6, padding: "12 14", borderLeftWidth: 4 },
  kpiLabel:     { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 5 },
  kpiValue:     { fontSize: 28, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  kpiSub:       { fontSize: 7.5, color: P.slate500 },
  // About
  aboutBox:     { borderRadius: 6, padding: "14 18", borderWidth: 1, borderColor: P.slate200, marginBottom: 14 },
  aboutLabel:   { fontSize: 7, fontFamily: "Helvetica-Bold", color: P.indigo, letterSpacing: 1, marginBottom: 4 },
  aboutValue:   { fontSize: 10, color: P.slate900, fontFamily: "Helvetica-Bold", lineHeight: 1.4 },
  aboutBody:    { fontSize: 9, color: P.slate700, lineHeight: 1.65, marginTop: 4 },
  metaGrid:     { flexDirection: "row", gap: 12, marginTop: 14 },
  metaTile:     { flex: 1, backgroundColor: P.slate100, borderRadius: 5, padding: "8 10" },
  metaLabel:    { fontSize: 7, color: P.slate500, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 3 },
  metaValue:    { fontSize: 10, fontFamily: "Helvetica-Bold", color: P.slate900 },
  // Table
  table:        { borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: P.slate200 },
  tableHdr:     { flexDirection: "row", backgroundColor: P.slate900, padding: "7 10" },
  tableHdrCell: { fontSize: 7.5, color: P.white, fontFamily: "Helvetica-Bold" },
  tableRow:     { flexDirection: "row", padding: "6 10", borderBottomWidth: 1, borderBottomColor: P.slate200 },
  tableRowAlt:  { backgroundColor: P.slate100 },
  tableCell:    { fontSize: 8, color: P.slate700 },
  // Bar chart
  barRow:       { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  barLabel:     { width: 76, fontSize: 7.5, color: P.slate700, textAlign: "right", marginRight: 8 },
  barTrack:     { flex: 1, height: 9, backgroundColor: P.slate200, borderRadius: 4, overflow: "hidden" },
  barFill:      { height: 9, borderRadius: 4 },
  barCount:     { width: 26, fontSize: 7.5, color: P.slate600, textAlign: "right", marginLeft: 7, fontFamily: "Helvetica-Bold" },
  // Two-col
  cols2:        { flexDirection: "row", gap: 16 },
  col:          { flex: 1 },
  colHdr:       { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: P.slate700, marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: P.slate200 },
  // Health callout
  health:       { borderRadius: 6, padding: "10 14", marginBottom: 20, borderLeftWidth: 4 },
  // Footer
  footer:       { position: "absolute", bottom: 22, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLine:   { position: "absolute", bottom: 38, left: 52, right: 52, height: 0.5, backgroundColor: P.slate200 },
  footerText:   { fontSize: 7, color: P.slate400 },
  // Page top bar
  topBar:       { height: 4, backgroundColor: P.indigo, marginBottom: 30, marginHorizontal: -52 },
});

// ── Shared components ─────────────────────────────────────────────────────────
function SectionHeader({ title, sub, num }: { title: string; sub?: string; num?: number }) {
  return (
    <View style={s.sectionHdr}>
      <View style={s.sectionDot} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          {num !== undefined && (
            <Text style={{ fontSize: 9, color: P.indigo, fontFamily: "Helvetica-Bold", width: 20 }}>{num}.</Text>
          )}
          <Text style={s.sectionTitle}>{title}</Text>
        </View>
        {sub && <Text style={s.sectionSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function ChartNote({ heading, body }: { heading: string; body: string }) {
  return (
    <View style={s.chartNote}>
      <Text style={s.chartNoteHdr}>{heading}</Text>
      <Text style={s.chartNoteBody}>{body}</Text>
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
              width: `${Math.max(3, (d.value / Math.max(1, maxVal)) * 100)}%`,
              backgroundColor: colors[d.label] ?? P.indigo,
            }]} />
          </View>
          <Text style={s.barCount}>{d.value}</Text>
        </View>
      ))}
    </View>
  );
}

function TrendSvg({ data, width = 440, height = 130 }: {
  data: { label: string; opened: number; closed: number }[];
  width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const pad = { t: 12, b: 22, l: 10, r: 10 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.opened, d.closed)));
  const xStep = W / Math.max(1, data.length - 1);
  const yv = (v: number) => pad.t + H - (v / maxVal) * H;
  const xv = (i: number) => pad.l + i * xStep;
  const openPath  = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xv(i)} ${yv(d.opened)}`).join(" ");
  const closePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xv(i)} ${yv(d.closed)}`).join(" ");
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, Math.round(maxVal / 2), maxVal].map((v) => (
        <React.Fragment key={v}>
          <Line x1={pad.l} y1={yv(v)} x2={pad.l + W} y2={yv(v)} stroke={P.slate200} strokeWidth={0.5} />
        </React.Fragment>
      ))}
      {/* Area fill — opened */}
      <Path
        d={`${openPath} L ${xv(data.length - 1)} ${pad.t + H} L ${xv(0)} ${pad.t + H} Z`}
        fill={P.indigo} opacity={0.08}
      />
      {/* Lines */}
      <Path d={openPath}  stroke={P.indigo} strokeWidth={2} fill="none" />
      <Path d={closePath} stroke={P.green}  strokeWidth={2} fill="none" strokeDasharray="4 2" />
      {/* Data points */}
      {data.map((d, i) => (
        <React.Fragment key={i}>
          <Circle cx={xv(i)} cy={yv(d.opened)} r={3} fill={P.white} stroke={P.indigo} strokeWidth={1.5} />
          <Circle cx={xv(i)} cy={yv(d.closed)} r={3} fill={P.white} stroke={P.green}  strokeWidth={1.5} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

function PageFooter({ project, date }: { project: string; date: string }) {
  return (
    <>
      <View style={s.footerLine} fixed />
      <View style={s.footer} fixed>
        <Text style={s.footerText}>Forge Analytics Report  ·  {project}</Text>
        <Text style={s.footerText}>{date}</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  );
}

// ── Sections registry (drives TOC) ────────────────────────────────────────────
const SECTIONS = [
  { num: 1, title: "About This Report",    sub: "Project context and objectives",     page: 3 },
  { num: 2, title: "Executive Summary",    sub: "Key metrics and health status",       page: 4 },
  { num: 3, title: "Issue Trends",         sub: "Weekly velocity and type breakdown",  page: 5 },
  { num: 4, title: "Team & Workload",      sub: "Assignee distribution and blockers",  page: 6 },
];

// ── Document ──────────────────────────────────────────────────────────────────
function ReportDoc({ data, project, projectName, from, to }: {
  data: ReportsData;
  project: Project | null;
  projectName: string;
  from: string;
  to: string;
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
  const healthColor = health === "blocked" ? P.red : health === "at_risk" ? P.amber : P.green;
  const healthBg    = health === "blocked" ? P.redLight : health === "at_risk" ? P.amberLight : P.greenLight;

  function fmtDate(d: string | null) {
    if (!d) return "Not set";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  const statusDisplay = project?.status
    ? ({ active: "Active", on_hold: "On Hold", closed: "Closed", archived: "Archived" }[project.status] ?? project.status)
    : "N/A";

  return (
    <Document author="Forge" title={`${projectName} Analytics Report`} creator="Forge">

      {/* ── Page 1: Cover ────────────────────────────────────────────────── */}
      <Page size="A4" style={s.cover}>
        <View style={s.coverTop}>
          <Text style={s.coverBrand}>▣  FORGE</Text>
          <Text style={s.coverTitle}>{projectName}{"\n"}Analytics Report</Text>
          <Text style={s.coverSub}>Reporting Period: {dateRange}</Text>
          <Text style={s.coverDate}>Prepared on {genDate}  ·  Confidential</Text>
        </View>
        <View style={{ height: 6, backgroundColor: P.indigo }} />
        <View style={{ height: 2, backgroundColor: "#818cf8" }} />
      </Page>

      {/* ── Page 2: Table of Contents ─────────────────────────────────────── */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={s.topBar} />
        {/* Header */}
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 8, color: P.indigo, fontFamily: "Helvetica-Bold", letterSpacing: 3, marginBottom: 6 }}>
            TABLE OF CONTENTS
          </Text>
          <View style={{ height: 2, backgroundColor: P.indigo, width: 40 }} />
        </View>
        {/* TOC rows */}
        {SECTIONS.map((sec) => (
          <View key={sec.num} style={s.tocRow}>
            {/* Number */}
            <Text style={s.tocNum}>{sec.num}</Text>
            {/* Title + sub + dots on same block */}
            <View style={{ flex: 1 }}>
              {/* Title line with dots leader and page number */}
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text style={s.tocTitle}>{sec.title}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: P.slate300, marginHorizontal: 8, marginBottom: 3 }} />
                <Text style={s.tocPage}>{sec.page}</Text>
              </View>
              {/* Subtitle below */}
              <Text style={[s.tocSub, { marginTop: 2 }]}>{sec.sub}</Text>
            </View>
          </View>
        ))}
        {/* Separator */}
        <View style={{ marginTop: 32, padding: "14 18", backgroundColor: P.slate100, borderRadius: 6 }}>
          <Text style={{ fontSize: 7.5, color: P.slate500, lineHeight: 1.65 }}>
            This report was automatically generated by Forge, a multi-tenant project management and issue-tracking platform.
            Data is sourced directly from the Forge issue database and reflects the state of work as of {genDate}.
            All figures are current as of the reporting period: {dateRange}.
          </Text>
        </View>
        <PageFooter project={projectName} date={genDate} />
      </Page>

      {/* ── Page 3: About This Report ─────────────────────────────────────── */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={s.topBar} />
        <SectionHeader title="About This Report" sub="Project context and background" num={1} />

        {project ? (
          <View>
            {/* Project name + key badge */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <View style={{ backgroundColor: P.indigoLight, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: P.indigo }}>{project.key}</Text>
              </View>
              <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: P.slate900 }}>{project.name}</Text>
              <View style={{ flex: 1 }} />
              <View style={{ backgroundColor: health === "good" ? P.greenLight : health === "at_risk" ? P.amberLight : P.redLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: healthColor }}>
                  {health === "good" ? "● On Track" : health === "at_risk" ? "● At Risk" : "● Needs Attention"}
                </Text>
              </View>
            </View>

            {/* Description */}
            <View style={[s.aboutBox, { marginBottom: 16 }]}>
              <Text style={s.aboutLabel}>PROJECT DESCRIPTION</Text>
              <Text style={s.aboutBody}>
                {project.description?.trim()
                  ? project.description.trim()
                  : "No description has been added to this project. Project owners can add a description in the Forge project settings to provide stakeholders with context about the project's goals and scope."}
              </Text>
            </View>

            {/* Meta grid */}
            <View style={s.metaGrid}>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>STATUS</Text>
                <Text style={[s.metaValue, { color: project.status === "active" ? P.green : P.slate600 }]}>{statusDisplay}</Text>
              </View>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>START DATE</Text>
                <Text style={s.metaValue}>{fmtDate(project.start_date)}</Text>
              </View>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>TARGET GO-LIVE</Text>
                <Text style={[s.metaValue, { color: project.target_go_live ? P.indigo : P.slate400 }]}>
                  {fmtDate(project.target_go_live)}
                </Text>
              </View>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>PROJECT KEY</Text>
                <Text style={[s.metaValue, { color: P.indigo }]}>{project.key}</Text>
              </View>
            </View>

            {/* What this report covers */}
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: P.slate900, marginBottom: 10 }}>
                What This Report Covers
              </Text>
              {[
                { title: "Executive Summary", body: "A high-level view of open vs. closed issues, average cycle time, and project health. Designed to give leadership a 30-second read on current status." },
                { title: "Issue Trends",      body: "Weekly velocity chart showing how quickly the team is opening and closing work. Includes a breakdown by issue type (Bug, Feature, Task) and cycle time data." },
                { title: "Team & Workload",   body: "Distribution of open issues across team members to identify imbalances or overloaded individuals. Also highlights any blocked issues that need escalation." },
              ].map((item) => (
                <View key={item.title} style={{ flexDirection: "row", marginBottom: 10 }}>
                  <View style={{ width: 4, height: 4, backgroundColor: P.indigo, borderRadius: 2, marginTop: 4.5, marginRight: 8, flexShrink: 0 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: P.slate800, marginBottom: 2 }}>{item.title}</Text>
                    <Text style={{ fontSize: 8, color: P.slate500, lineHeight: 1.55 }}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* All-projects variant */
          <View>
            <View style={[s.aboutBox, { marginBottom: 16 }]}>
              <Text style={s.aboutLabel}>SCOPE</Text>
              <Text style={s.aboutBody}>
                This report covers all active projects in the Forge workspace for the period {dateRange}.
                It aggregates issue data across {data.projects.length} project{data.projects.length !== 1 ? "s" : ""} to provide a
                workspace-wide view of engineering throughput, team workload, and risk.
              </Text>
            </View>
            <View style={s.metaGrid}>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>PROJECTS INCLUDED</Text>
                <Text style={s.metaValue}>{data.projects.length}</Text>
              </View>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>REPORTING PERIOD</Text>
                <Text style={[s.metaValue, { fontSize: 8 }]}>{dateRange}</Text>
              </View>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>TOTAL ISSUES</Text>
                <Text style={s.metaValue}>{totalIssues}</Text>
              </View>
              <View style={s.metaTile}>
                <Text style={s.metaLabel}>GENERATED</Text>
                <Text style={[s.metaValue, { fontSize: 8 }]}>{genDate}</Text>
              </View>
            </View>
            {data.projects.length > 0 && (
              <View style={{ marginTop: 18 }}>
                <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: P.slate700, marginBottom: 8 }}>Projects Included in This Report</Text>
                {data.projects.map((p, i) => (
                  <View key={p.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: P.slate200 }}>
                    <Text style={{ width: 22, fontSize: 7.5, color: P.slate400 }}>{i + 1}.</Text>
                    <View style={{ backgroundColor: P.indigoLight, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, marginRight: 8 }}>
                      <Text style={{ fontSize: 7, color: P.indigo, fontFamily: "Helvetica-Bold" }}>{p.key}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 8.5, color: P.slate800, fontFamily: "Helvetica-Bold" }}>{p.name}</Text>
                    <Text style={{ fontSize: 7.5, color: P.slate400 }}>{(p as { status?: string }).status ?? ""}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <PageFooter project={projectName} date={genDate} />
      </Page>

      {/* ── Page 4: Executive Summary ──────────────────────────────────────── */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={s.topBar} />
        <SectionHeader title="Executive Summary" sub={`Key metrics for ${dateRange}`} num={2} />

        {/* KPI tiles */}
        <ChartNote
          heading="How to read these metrics"
          body={`These four indicators provide an immediate snapshot of project health. "Open Issues" counts all non-done work. "Closed in Period" shows how much was completed in the selected date range — your team's output. "Avg Cycle Time" is how many days it typically takes an issue to go from creation to done; lower is better. "Blocked" highlights issues that cannot progress and need escalation.`}
        />
        <View style={[s.kpiGrid, { marginBottom: 20 }]}>
          <KpiBox label="Open Issues"      value={String(data.totalOpen)}  sub="currently open"     color={P.indigo}  bg={P.indigoLight} borderColor={P.indigo} />
          <KpiBox label="Closed in Period" value={String(data.totalDone)}  sub={dateRange}           color="#15803d"   bg={P.greenLight}  borderColor={P.green} />
          <KpiBox label="Avg Cycle Time"   value={data.avgCycleDays != null ? `${data.avgCycleDays}d` : "—"} sub="created → done" color="#92400e" bg={P.amberLight} borderColor={P.amber} />
          <KpiBox label="Blocked"          value={String(data.blockedIssues.length)} sub={`${data.blockedDaysTotal} blocked-days`} color="#991b1b" bg={P.redLight} borderColor={P.red} />
        </View>

        {/* Health callout */}
        <View style={[s.health, { backgroundColor: healthBg, borderLeftColor: healthColor }]}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: P.slate900, marginBottom: 4 }}>
            {health === "blocked" ? "⚠  Action Required — Blocked Issues Detected"
             : health === "at_risk" ? "⚡  Attention — Open Issue Backlog is Elevated"
             : "✓  Project Health Looks Good"}
          </Text>
          <Text style={{ fontSize: 8, color: P.slate700, lineHeight: 1.6 }}>
            {health === "blocked"
              ? `There are currently ${data.blockedIssues.length} blocked issue${data.blockedIssues.length > 1 ? "s" : ""} in this project, accumulating a combined ${data.blockedDaysTotal} blocked-days. Blocked issues halt progress and can put timelines at risk. Each blocked item should have a named owner and a resolution path before the next status update.`
              : health === "at_risk"
              ? `The ratio of open to closed issues is elevated — ${data.totalOpen} open vs. ${data.totalDone} closed in this period. This may indicate the team is taking on more work than it is completing, or that a backlog is growing. Review issue prioritization to ensure the highest-value work is being completed first.`
              : `The project is progressing normally. ${data.totalDone} issue${data.totalDone !== 1 ? "s" : ""} closed in the period, with ${data.totalOpen} remaining open. Avg cycle time of ${data.avgCycleDays != null ? `${data.avgCycleDays} days` : "N/A"} indicates healthy throughput.`}
          </Text>
        </View>

        {/* Status + Priority */}
        <ChartNote
          heading="Status and Priority Distribution"
          body="The charts below show how work is distributed across pipeline stages (left) and urgency levels (right) for the selected period. A healthy project will have a large 'Done' bar and a small 'Blocked' bar. In priority, 'Urgent' items should be few — a large Urgent count signals planning or scoping issues."
        />
        <View style={s.cols2}>
          <View style={s.col}>
            <Text style={s.colHdr}>By Status</Text>
            <BarChart
              data={data.byStatus.map((st) => ({ label: statusLabels[st.status] ?? st.status, value: st.count }))}
              colors={statusColors}
              maxVal={Math.max(1, ...data.byStatus.map((st) => st.count))}
            />
          </View>
          <View style={s.col}>
            <Text style={s.colHdr}>By Priority (Open Only)</Text>
            <BarChart
              data={data.byPriority.map((p) => ({ label: p.priority.charAt(0).toUpperCase() + p.priority.slice(1), value: p.count }))}
              colors={priorityColors}
              maxVal={Math.max(1, ...data.byPriority.map((p) => p.count))}
            />
          </View>
        </View>

        <PageFooter project={projectName} date={genDate} />
      </Page>

      {/* ── Page 5: Trend Analysis ─────────────────────────────────────────── */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={s.topBar} />
        <SectionHeader title="Issue Trends" sub="Weekly velocity and type breakdown" num={3} />

        <ChartNote
          heading="How to read the Velocity Chart"
          body={`This line chart plots two weekly metrics: Issues Opened (solid indigo line) and Issues Closed (dashed green line). When the green line is above the indigo line, the team is completing more than it starts — a healthy sign of forward momentum. When the indigo line stays above green for multiple consecutive weeks, the backlog is growing. The ideal pattern is the two lines tracking closely together or green leading slightly.`}
        />

        <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 20, height: 2, backgroundColor: P.indigo }} />
            <Text style={{ fontSize: 7.5, color: P.slate600 }}>Opened per week</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 20, height: 2, backgroundColor: P.green }} />
            <Text style={{ fontSize: 7.5, color: P.slate600 }}>Closed per week</Text>
          </View>
        </View>

        {data.weeklyTrend.length >= 2
          ? <TrendSvg data={data.weeklyTrend.slice(-12)} width={460} height={130} />
          : <View style={{ height: 80, justifyContent: "center", alignItems: "center", backgroundColor: P.slate100, borderRadius: 6 }}>
              <Text style={{ fontSize: 9, color: P.slate400 }}>Not enough data yet — trends will appear once issues span at least two calendar weeks</Text>
            </View>
        }

        <View style={{ marginTop: 24 }} />

        <ChartNote
          heading="Issue Type Breakdown"
          body="This table shows how work is categorized — Bugs (defects requiring fixes), Features (new functionality), and Tasks (operational or support work). A high Bug % relative to Features may indicate quality debt that needs addressing before new feature work. Industry-healthy projects typically keep bugs below 25–30% of total closed issues."
        />
        <View style={[s.table, { marginBottom: 20 }]}>
          <View style={s.tableHdr}>
            <Text style={[s.tableHdrCell, { flex: 2 }]}>Issue Type</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Count</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Share of Total</Text>
          </View>
          {data.byType.map((t, i) => {
            const lbl = t.type.charAt(0).toUpperCase() + t.type.slice(1);
            return (
              <View key={t.type} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: typeColors[lbl] ?? P.indigo }} />
                  <Text style={s.tableCell}>{lbl}s</Text>
                </View>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{t.count}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{Math.round((t.count / Math.max(1, totalIssues)) * 100)}%</Text>
              </View>
            );
          })}
        </View>

        {data.avgCycleDays != null && (
          <View>
            <ChartNote
              heading="Cycle Time"
              body={`Cycle time measures how long it takes from when an issue is created to when it is marked done. The current average is ${data.avgCycleDays} days. Lower cycle times indicate a team that ships iteratively and keeps work small. Long cycle times often point to issues being blocked, scope creep, or insufficient review capacity. The stage breakdown below shows where time is typically spent in the workflow.`}
            />
            <View style={{ flexDirection: "row", gap: 14, backgroundColor: P.amberLight, borderRadius: 6, padding: "12 16" }}>
              <View style={{ minWidth: 60 }}>
                <Text style={{ fontSize: 26, fontFamily: "Helvetica-Bold", color: P.slate900 }}>{data.avgCycleDays}d</Text>
                <Text style={{ fontSize: 7.5, color: P.slate500, marginTop: 2 }}>Avg cycle time</Text>
              </View>
              <View style={{ flex: 1, justifyContent: "center", borderLeftWidth: 1, borderLeftColor: "#fbbf24", paddingLeft: 14 }}>
                {data.cycleByStage.map((cs) => (
                  <View key={cs.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <Text style={{ fontSize: 8, color: P.slate700 }}>{cs.label}</Text>
                    <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: P.amber }}>{cs.avgDays}d avg</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <PageFooter project={projectName} date={genDate} />
      </Page>

      {/* ── Page 6: Team & Blockers ────────────────────────────────────────── */}
      <Page size="A4" style={[s.page, s.body]}>
        <View style={s.topBar} />
        <SectionHeader title="Team & Workload" sub="Assignee distribution and blocked issues" num={4} />

        <ChartNote
          heading="How to read the Workload Distribution"
          body="Each bar shows the number of open (non-done) issues assigned to a team member. The goal is a roughly even distribution — a single person holding a disproportionate share may be a bottleneck or indicate scope is not being delegated effectively. 'Unassigned' issues are work that has not yet been claimed and may be delaying progress."
        />
        <View style={[s.table, { marginBottom: 24 }]}>
          <View style={s.tableHdr}>
            <Text style={[s.tableHdrCell, { flex: 3 }]}>Assignee</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "center" }]}>Open Issues</Text>
            <Text style={[s.tableHdrCell, { flex: 2 }]}>Workload</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Share</Text>
          </View>
          {data.byAssignee.slice(0, 12).map((a, i) => {
            const tot = data.byAssignee.reduce((sum, x) => sum + x.count, 0);
            const pct = (a.count / Math.max(1, tot)) * 100;
            return (
              <View key={a.name} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.tableCell, { flex: 3, fontFamily: a.assigneeId ? "Helvetica" : "Helvetica-Bold", color: a.assigneeId ? P.slate700 : P.slate900 }]}>{a.name}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "center", fontFamily: "Helvetica-Bold", color: P.indigo }]}>{a.count}</Text>
                <View style={{ flex: 2, paddingVertical: 5 }}>
                  <View style={{ height: 7, backgroundColor: P.slate200, borderRadius: 3 }}>
                    <View style={{ width: `${Math.max(3, pct)}%`, height: 7, backgroundColor: a.assigneeId ? P.indigo : P.amber, borderRadius: 3 }} />
                  </View>
                </View>
                <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>{Math.round(pct)}%</Text>
              </View>
            );
          })}
        </View>

        {data.blockedIssues.length > 0 ? (
          <View>
            <ChartNote
              heading="Blocked Issues — Escalation Required"
              body={`There are currently ${data.blockedIssues.length} issue${data.blockedIssues.length > 1 ? "s" : ""} that cannot progress. The table below lists each one with how many days it has been open. Blocked issues that persist for more than 3–5 days typically require management intervention to remove the dependency or make a scope decision. The "Days" column sorts from oldest to newest — prioritize resolving long-standing blockers first.`}
            />
            <View style={s.table}>
              <View style={[s.tableHdr, { backgroundColor: P.red }]}>
                <Text style={[s.tableHdrCell, { flex: 1 }]}>Issue Key</Text>
                <Text style={[s.tableHdrCell, { flex: 4 }]}>Title</Text>
                <Text style={[s.tableHdrCell, { flex: 2 }]}>Assignee</Text>
                <Text style={[s.tableHdrCell, { flex: 1, textAlign: "right" }]}>Days Blocked</Text>
              </View>
              {data.blockedIssues.sort((a, b) => b.daysOld - a.daysOld).slice(0, 15).map((b, i) => (
                <View key={b.id} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: P.redLight } : {}]}>
                  <Text style={[s.tableCell, { flex: 1, fontFamily: "Helvetica-Bold", color: P.slate700 }]}>{b.key}</Text>
                  <Text style={[s.tableCell, { flex: 4 }]}>{b.title.length > 52 ? b.title.slice(0, 52) + "…" : b.title}</Text>
                  <Text style={[s.tableCell, { flex: 2 }]}>{b.assigneeName}</Text>
                  <Text style={[s.tableCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold", color: P.red }]}>{b.daysOld}d</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: P.greenLight, borderRadius: 6, padding: "14 18", borderLeftWidth: 4, borderLeftColor: P.green }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#15803d", marginBottom: 4 }}>✓  No Blocked Issues</Text>
            <Text style={{ fontSize: 8, color: P.slate700, lineHeight: 1.6 }}>
              All issues in this project are progressing normally. There are no items currently flagged as blocked. Continue monitoring this section in future reports — early identification of blockers is one of the most valuable uses of regular status reporting.
            </Text>
          </View>
        )}

        <PageFooter project={projectName} date={genDate} />
      </Page>

    </Document>
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────
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

  const [data, fullProjects] = await Promise.all([
    loadReports(ctx.tenant.id, from, to, projectId, ctx.impersonating),
    projectsRepo(createSupabaseServiceClient()).listByTenant(ctx.tenant.id).catch(() => [] as Project[]),
  ]);

  // Resolve the full project object (with description, dates, status) for the About page
  const project: Project | null = projectId
    ? (fullProjects.find((p) => p.id === projectId) ?? null)
    : null;

  const projectName = project?.name ?? "All Projects";
  const fromStr = from.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const toStr   = to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const buffer = await renderToBuffer(
    <ReportDoc data={data} project={project} projectName={projectName} from={fromStr} to={toStr} />,
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
