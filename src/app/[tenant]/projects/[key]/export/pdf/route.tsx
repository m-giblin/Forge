import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { renderToBuffer, Document, Page, View, Text, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const P = {
  indigo: "#6366f1", indigoDark: "#4338ca", indigoDeep: "#312e81",
  green: "#22c55e", amber: "#f59e0b", red: "#ef4444",
  slate900: "#0f172a", slate800: "#1e293b", slate700: "#334155",
  slate600: "#475569", slate500: "#64748b", slate400: "#94a3b8",
  slate300: "#cbd5e1", slate200: "#e2e8f0", slate100: "#f8fafc", white: "#ffffff",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: P.slate600, backgroundColor: P.white },
  cover: { width: "100%", height: "100%", backgroundColor: P.indigoDeep, flexDirection: "column", justifyContent: "flex-end", padding: "60 64" },
  coverEyebrow: { fontSize: 9, color: "#818cf8", fontFamily: "Helvetica-Bold", letterSpacing: 4, marginBottom: 20 },
  coverTitle: { fontSize: 30, color: P.white, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 10 },
  coverMeta: { fontSize: 10, color: "#a5b4fc", marginBottom: 4 },
  coverDate: { fontSize: 9, color: "#6366f1", marginTop: 20 },
  body: { padding: "36 52" },
  topBar: { height: 4, backgroundColor: P.indigo, marginBottom: 28, marginHorizontal: -52 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: P.slate900, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: P.slate200 },
  kpiGrid: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpiBox: { flex: 1, backgroundColor: P.slate100, borderRadius: 6, padding: "10 12", borderLeftWidth: 3 },
  kpiLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: P.slate400, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: P.slate900 },
  kpiSub: { fontSize: 7, color: P.slate400, marginTop: 2 },
  tableHdr: { flexDirection: "row", backgroundColor: P.slate900, padding: "7 10" },
  tableHdrCell: { fontSize: 7.5, color: P.white, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", padding: "5 10", borderBottomWidth: 1, borderBottomColor: P.slate200 },
  tableCell: { fontSize: 7.5, color: P.slate700 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  barLabel: { width: 70, fontSize: 7.5, color: P.slate600, textAlign: "right", marginRight: 8 },
  barTrack: { flex: 1, height: 9, backgroundColor: P.slate200, borderRadius: 4 },
  barCount: { width: 24, fontSize: 8, color: P.slate900, fontFamily: "Helvetica-Bold", textAlign: "right", marginLeft: 6 },
  progressTrack: { height: 12, backgroundColor: P.slate200, borderRadius: 6 },
  footer: { position: "absolute", bottom: 20, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: P.slate400 },
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtCents(c: number) { return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

function Footer({ tenant, date }: { tenant: string; date: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>CONFIDENTIAL · FORGE · {tenant}</Text>
      <Text style={s.footerText}>{date}</Text>
    </View>
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenant: string; key: string }> }) {
  void req;
  const { tenant: slug, key: projectKey } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const isAdmin = ctx.role === "owner" || ctx.role === "admin" || ctx.impersonating;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const projectRes = await svc.from("projects").select("id, name, key, status, start_date, end_date, description, budget_cents").eq("tenant_id", ctx.tenant.id).eq("key", projectKey).maybeSingle();
  const project = projectRes.data;
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [issuesRes, sprintRes, memberRes] = await Promise.all([
    svc.from("issues").select("id, number, title, status, priority, assignee_id, story_points, sprint_id, created_at").eq("tenant_id", ctx.tenant.id).eq("project_id", project.id as string),
    svc.from("sprints").select("id, name, committed_story_points, completed_story_points, status, start_date, end_date").eq("tenant_id", ctx.tenant.id).eq("project_id", project.id as string).eq("status", "active").maybeSingle(),
    svc.from("memberships").select("user:users!inner(id, name, email)").eq("tenant_id", ctx.tenant.id),
  ]);

  const issues = issuesRes.data ?? [];
  const activeSprint = sprintRes.data;
  const userMap = new Map<string, string>();
  for (const m of memberRes.data ?? []) {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    userMap.set(u.id, u.name ?? u.email);
  }

  const isDone = (st: string) => st === "done" || st === "closed";
  const doneIssues = issues.filter((i) => isDone(i.status as string));
  const openIssues = issues.filter((i) => !isDone(i.status as string));
  const inProgress = issues.filter((i) => i.status === "in_progress");
  const highRisk = issues.filter((i) => (i.priority === "urgent" || i.priority === "high") && !isDone(i.status as string)).slice(0, 5);
  const pctDone = issues.length > 0 ? Math.round((doneIssues.length / issues.length) * 100) : 0;

  // Budget
  let spendCents = 0;
  if (project.budget_cents) {
    const logRes = await svc.from("issue_time_logs").select("minutes, hourly_rate_cents").eq("tenant_id", ctx.tenant.id).in("issue_id", issues.map((i) => i.id as string));
    for (const l of logRes.data ?? []) {
      if (l.hourly_rate_cents) spendCents += Math.round(((l.minutes as number) / 60) * (l.hourly_rate_cents as number));
    }
  }

  // Assignee workload
  const assigneeMap = new Map<string, number>();
  for (const i of openIssues) {
    const uid = i.assignee_id as string | null;
    if (uid) assigneeMap.set(uid, (assigneeMap.get(uid) ?? 0) + 1);
  }
  const topAssignees = Array.from(assigneeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxAssigneeCt = Math.max(1, ...topAssignees.map((a) => a[1]));

  // Status breakdown
  const statusMap = new Map<string, number>();
  for (const i of issues) statusMap.set(i.status as string, (statusMap.get(i.status as string) ?? 0) + 1);
  const statusOrder = ["backlog", "todo", "in_progress", "in_review", "done"];
  const statusRows = statusOrder.filter((s) => statusMap.has(s)).map((s) => ({ status: s, count: statusMap.get(s)! }));
  const maxStatusCt = Math.max(1, ...statusRows.map((r) => r.count));
  const statusColors: Record<string, string> = { backlog: P.slate400, todo: P.slate600, in_progress: P.indigo, in_review: "#8b5cf6", done: P.green };

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const barW = 240;

  const sprintVelocityPct = activeSprint && (activeSprint.committed_story_points as number | null)
    ? Math.round(((activeSprint.completed_story_points as number | null ?? 0) / (activeSprint.committed_story_points as number)) * 100)
    : null;

  const pdf = (
    <Document title={`Project Report – ${project.name}`} author="Forge">
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <Text style={s.coverEyebrow}>FORGE · PROJECT REPORT</Text>
          <Text style={s.coverTitle}>{project.name as string}</Text>
          <Text style={s.coverMeta}>Project Key: {project.key as string} · Status: {(project.status as string).toUpperCase()}</Text>
          {(project.start_date || project.end_date) && (
            <Text style={s.coverMeta}>{fmtDate(project.start_date as string | null)} → {fmtDate(project.end_date as string | null)}</Text>
          )}
          <Text style={s.coverDate}>Generated {dateStr} · {ctx.tenant.name}</Text>
        </View>
      </Page>

      {/* Overview + KPIs */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View style={s.topBar} />
          <Text style={s.sectionTitle}>Project Health</Text>
          <View style={s.kpiGrid}>
            {[
              { label: "TOTAL ISSUES", value: String(issues.length), color: P.slate700 },
              { label: "DONE", value: String(doneIssues.length), color: P.green },
              { label: "IN PROGRESS", value: String(inProgress.length), color: P.indigo },
              { label: "OPEN", value: String(openIssues.length), color: P.amber },
              { label: "% COMPLETE", value: `${pctDone}%`, color: pctDone >= 75 ? P.green : pctDone >= 40 ? P.amber : P.red },
            ].map((k) => (
              <View key={k.label} style={[s.kpiBox, { borderLeftColor: k.color }]}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
              </View>
            ))}
          </View>

          {/* Progress bar */}
          <View style={{ marginBottom: 20 }}>
            <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Completion</Text>
            <View style={s.progressTrack}>
              <Svg width={barW + 100} height={12}>
                <Rect x={0} y={0} width={((pctDone / 100) * (barW + 100))} height={12} fill={pctDone >= 75 ? P.green : pctDone >= 40 ? P.amber : P.red} rx={6} />
              </Svg>
            </View>
            <Text style={{ fontSize: 8, color: P.slate500, marginTop: 4 }}>{pctDone}% · {doneIssues.length} of {issues.length} issues done</Text>
          </View>

          {/* Budget */}
          {project.budget_cents && (
            <View style={{ marginBottom: 20 }}>
              <Text style={s.sectionTitle}>Budget</Text>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.kpiLabel}>BUDGET</Text>
                  <Text style={[s.kpiValue, { fontSize: 16, color: P.slate900 }]}>{fmtCents(project.budget_cents as number)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.kpiLabel}>SPENT (TIME-BASED)</Text>
                  <Text style={[s.kpiValue, { fontSize: 16, color: spendCents > (project.budget_cents as number) * 0.8 ? P.red : P.slate900 }]}>{fmtCents(spendCents)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.kpiLabel}>REMAINING</Text>
                  <Text style={[s.kpiValue, { fontSize: 16, color: P.green }]}>{fmtCents(Math.max(0, (project.budget_cents as number) - spendCents))}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Active sprint */}
          {activeSprint && (
            <View style={{ marginBottom: 20 }}>
              <Text style={s.sectionTitle}>Active Sprint: {activeSprint.name as string}</Text>
              <Text style={{ fontSize: 8.5, color: P.slate600, marginBottom: 8 }}>
                {fmtDate(activeSprint.start_date as string | null)} – {fmtDate(activeSprint.end_date as string | null)}
                {sprintVelocityPct != null ? ` · Velocity: ${sprintVelocityPct}%` : ""}
              </Text>
            </View>
          )}

          <Footer tenant={ctx.tenant.name} date={dateStr} />
        </View>
      </Page>

      {/* Status breakdown + Workload */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View style={s.topBar} />
          <Text style={s.sectionTitle}>Issues by Status</Text>
          {statusRows.map((row) => (
            <View key={row.status} style={s.barRow}>
              <Text style={s.barLabel}>{row.status.replace(/_/g, " ")}</Text>
              <View style={s.barTrack}>
                <Svg width={barW} height={9}>
                  <Rect x={0} y={0} width={(row.count / maxStatusCt) * barW} height={9} fill={statusColors[row.status] ?? P.indigo} rx={4} />
                </Svg>
              </View>
              <Text style={s.barCount}>{row.count}</Text>
            </View>
          ))}

          {topAssignees.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={s.sectionTitle}>Open Issues by Assignee</Text>
              {topAssignees.map(([uid, ct]) => (
                <View key={uid} style={s.barRow}>
                  <Text style={s.barLabel}>{(userMap.get(uid) ?? uid).split(" ")[0].slice(0, 14)}</Text>
                  <View style={s.barTrack}>
                    <Svg width={barW} height={9}>
                      <Rect x={0} y={0} width={(ct / maxAssigneeCt) * barW} height={9} fill={P.indigo} rx={4} />
                    </Svg>
                  </View>
                  <Text style={s.barCount}>{ct}</Text>
                </View>
              ))}
            </View>
          )}

          <Footer tenant={ctx.tenant.name} date={dateStr} />
        </View>
      </Page>

      {/* Risk / High priority + Recent issues */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View style={s.topBar} />
          {highRisk.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={s.sectionTitle}>⚠ High-Risk Open Issues</Text>
              <View style={s.tableHdr}>
                {[["Key", 1], ["Title", 4], ["Priority", 1.5], ["Assignee", 2]].map(([h, flex]) => (
                  <Text key={String(h)} style={[s.tableHdrCell, { flex: Number(flex) }]}>{String(h)}</Text>
                ))}
              </View>
              {highRisk.map((issue, i) => (
                <View key={issue.id as string} style={[s.tableRow, { backgroundColor: i % 2 === 1 ? P.slate100 : P.white }]}>
                  <Text style={[s.tableCell, { flex: 1, color: P.slate500 }]}>{project.key as string}-{issue.number as number}</Text>
                  <Text style={[s.tableCell, { flex: 4, fontFamily: "Helvetica-Bold" }]}>{(issue.title as string).slice(0, 55)}</Text>
                  <Text style={[s.tableCell, { flex: 1.5, color: issue.priority === "urgent" ? P.red : P.amber, fontFamily: "Helvetica-Bold" }]}>
                    {(issue.priority as string).toUpperCase()}
                  </Text>
                  <Text style={[s.tableCell, { flex: 2 }]}>{issue.assignee_id ? (userMap.get(issue.assignee_id as string) ?? "—") : "Unassigned"}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.sectionTitle}>Recent Issues</Text>
          <View style={s.tableHdr}>
            {[["Key", 1], ["Title", 4], ["Status", 1.5], ["Priority", 1.5]].map(([h, flex]) => (
              <Text key={String(h)} style={[s.tableHdrCell, { flex: Number(flex) }]}>{String(h)}</Text>
            ))}
          </View>
          {[...issues].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()).slice(0, 15).map((issue, i) => (
            <View key={issue.id as string} style={[s.tableRow, { backgroundColor: i % 2 === 1 ? P.slate100 : P.white }]}>
              <Text style={[s.tableCell, { flex: 1, color: P.slate500 }]}>{project.key as string}-{issue.number as number}</Text>
              <Text style={[s.tableCell, { flex: 4 }]}>{(issue.title as string).slice(0, 55)}</Text>
              <Text style={[s.tableCell, { flex: 1.5, textTransform: "capitalize", color: isDone(issue.status as string) ? P.green : P.slate600 }]}>
                {(issue.status as string).replace(/_/g, " ")}
              </Text>
              <Text style={[s.tableCell, { flex: 1.5, textTransform: "capitalize" }]}>{issue.priority as string}</Text>
            </View>
          ))}

          <Footer tenant={ctx.tenant.name} date={dateStr} />
        </View>
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(pdf);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="project-report-${project.key as string}.pdf"`,
    },
  });
}
