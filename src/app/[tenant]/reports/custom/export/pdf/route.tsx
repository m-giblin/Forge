import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
import { renderToBuffer, Document, Page, View, Text, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
import type { GroupBy, Metric, DateGroup } from "@/app/api/reports/custom/route";

export const dynamic = "force-dynamic";

// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const P = {
  indigo: "#6366f1", indigoDark: "#4338ca", indigoDeep: "#312e81",
  green: "#22c55e", amber: "#f59e0b", red: "#ef4444",
  slate900: "#0f172a", slate800: "#1e293b", slate600: "#475569",
  slate400: "#94a3b8", slate200: "#e2e8f0", slate100: "#f8fafc", white: "#ffffff",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: P.slate600, backgroundColor: P.white },
  cover: { width: "100%", height: "100%", backgroundColor: P.indigoDeep, flexDirection: "column", justifyContent: "flex-end", padding: "60 64" },
  coverBrand: { fontSize: 10, color: "#818cf8", fontFamily: "Helvetica-Bold", letterSpacing: 4, marginBottom: 24 },
  coverTitle: { fontSize: 32, color: P.white, fontFamily: "Helvetica-Bold", lineHeight: 1.25, marginBottom: 16 },
  coverSub: { fontSize: 11, color: "#a5b4fc", marginBottom: 6 },
  coverDate: { fontSize: 9, color: "#6366f1" },
  body: { padding: "36 52" },
  topBar: { height: 4, backgroundColor: P.indigo, marginBottom: 28, marginHorizontal: -52 },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: P.slate900, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: P.slate200 },
  kpiGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  kpiBox: { flex: 1, borderRadius: 6, backgroundColor: P.slate100, padding: "12 14", borderLeftWidth: 3 },
  kpiLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 5, color: P.slate400 },
  kpiValue: { fontSize: 24, fontFamily: "Helvetica-Bold", color: P.slate900 },
  kpiSub: { fontSize: 7.5, color: P.slate400, marginTop: 3 },
  tableHdr: { flexDirection: "row", backgroundColor: P.slate900, padding: "8 10" },
  tableHdrCell: { fontSize: 7.5, color: P.white, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", padding: "6 10", borderBottomWidth: 1, borderBottomColor: P.slate200 },
  tableCell: { fontSize: 8, color: P.slate600 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  barLabel: { width: 80, fontSize: 7.5, color: P.slate600, textAlign: "right", marginRight: 8 },
  barTrack: { flex: 1, height: 10, backgroundColor: P.slate200, borderRadius: 4 },
  barCount: { width: 28, fontSize: 8, color: P.slate900, fontFamily: "Helvetica-Bold", textAlign: "right", marginLeft: 8 },
  footer: { position: "absolute", bottom: 20, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: P.slate400 },
});

const PALETTE = [P.indigo, P.green, "#f97316", P.red, "#8b5cf6", "#0ea5e9", P.amber, P.slate600, "#ec4899", "#14b8a6"];
function dimLabel(d: string) { return d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

const CLOSED_STATUSES = new Set(["done", "closed"]);
const VALID_GROUP_BY = ["status", "priority", "type", "assignee", "label", "sprint", "phase", "environment"];
const VALID_METRICS = ["count", "story_points", "time_logged"];

function Footer({ tenant, date }: { tenant: string; date: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>FORGE · {tenant} · Custom Report</Text>
      <Text style={s.footerText}>{date}</Text>
    </View>
  );
}

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
  const projectId = sp.get("project") || null;
  const now = new Date();
  const defaultFrom = new Date(now); defaultFrom.setDate(defaultFrom.getDate() - 30);
  const fromStr = sp.get("from") ?? defaultFrom.toISOString().slice(0, 10);
  const toStr = sp.get("to") ?? now.toISOString().slice(0, 10);
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const metricLabel = metric === "count" ? "Issue Count" : metric === "story_points" ? "Story Points" : "Hours Logged";

  const svc = createSupabaseServiceClient();
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
    for (const dim of getDimensions(issue)) {
      const val = getVal(issue);
      const done = CLOSED_STATUSES.has(issue.status as string);
      const e = aggMap.get(dim) ?? { value: 0, open: 0, closed: 0 };
      e.value += val; if (done) e.closed += val; else e.open += val;
      aggMap.set(dim, e);
    }
  }
  const rows = Array.from(aggMap.entries())
    .map(([dim, s]) => ({ dim, value: Math.round(s.value * 10) / 10, open: Math.round(s.open * 10) / 10, closed: Math.round(s.closed * 10) / 10, pctDone: s.value > 0 ? Math.round((s.closed / s.value) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  const total = issues.length;
  const done = issues.filter((i) => CLOSED_STATUSES.has(i.status as string)).length;
  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;
  const totalPts = issues.reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);

  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  const barWidth = 280;

  const pdf = (
    <Document title={`Forge Custom Report – ${fromStr} to ${toStr}`} author="Forge">
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <Text style={s.coverBrand}>FORGE · CUSTOM REPORT</Text>
          <Text style={s.coverTitle}>{dimLabel(groupBy)} Breakdown</Text>
          <Text style={s.coverSub}>Metric: {metricLabel} · Period: {fromStr} → {toStr}</Text>
          <Text style={s.coverDate}>Generated {dateStr} · {ctx.tenant.name}</Text>
        </View>
      </Page>

      {/* Summary + Chart */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View style={s.topBar} />
          <Text style={s.sectionTitle}>Summary</Text>
          <View style={s.kpiGrid}>
            {[
              { label: "TOTAL ISSUES", value: String(total), sub: `${fromStr} to ${toStr}`, color: P.indigo },
              { label: "OPEN", value: String(total - done), sub: `${100 - pctDone}% of total`, color: "#4338ca" },
              { label: "DONE", value: String(done), sub: `${pctDone}% completion`, color: P.green },
              { label: "STORY POINTS", value: String(totalPts), sub: "total in period", color: P.amber },
            ].map((k) => (
              <View key={k.label} style={[s.kpiBox, { borderLeftColor: k.color }]}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
                <Text style={s.kpiSub}>{k.sub}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.sectionTitle, { marginTop: 8 }]}>{metricLabel} by {dimLabel(groupBy)}</Text>
          {rows.slice(0, 15).map((row, i) => (
            <View key={row.dim} style={s.barRow}>
              <Text style={s.barLabel}>{dimLabel(row.dim).slice(0, 18)}</Text>
              <View style={s.barTrack}>
                <Svg width={barWidth} height={10}>
                  <Rect x={0} y={0} width={(row.value / maxVal) * barWidth} height={10} fill={PALETTE[i % PALETTE.length]} rx={4} />
                </Svg>
              </View>
              <Text style={s.barCount}>{row.value}</Text>
            </View>
          ))}

          <Footer tenant={ctx.tenant.name} date={dateStr} />
        </View>
      </Page>

      {/* Data Table */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View style={s.topBar} />
          <Text style={s.sectionTitle}>Detailed Breakdown</Text>
          <View style={s.tableHdr}>
            {["Dimension", "Total", "Open", "Done", "% Done"].map((h, i) => (
              <Text key={h} style={[s.tableHdrCell, { flex: i === 0 ? 3 : 1 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View key={row.dim} style={[s.tableRow, { backgroundColor: i % 2 === 1 ? P.slate100 : P.white }]}>
              <Text style={[s.tableCell, { flex: 3, fontFamily: "Helvetica-Bold" }]}>{dimLabel(row.dim)}</Text>
              <Text style={[s.tableCell, { flex: 1, textAlign: "center" }]}>{row.value}</Text>
              <Text style={[s.tableCell, { flex: 1, textAlign: "center", color: P.indigo }]}>{row.open}</Text>
              <Text style={[s.tableCell, { flex: 1, textAlign: "center", color: P.green }]}>{row.closed}</Text>
              <Text style={[s.tableCell, { flex: 1, textAlign: "center" }]}>{row.pctDone}%</Text>
            </View>
          ))}
          <Footer tenant={ctx.tenant.name} date={dateStr} />
        </View>
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(pdf);
  const filename = `forge-custom-report-${groupBy}-${fromStr}-${toStr}.pdf`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
