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
  slate200: "#e2e8f0", slate100: "#f8fafc", white: "#ffffff",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: P.slate600, backgroundColor: P.white },
  cover: { width: "100%", height: "100%", backgroundColor: P.indigoDeep, flexDirection: "column", justifyContent: "flex-end", padding: "60 64" },
  coverEyebrow: { fontSize: 9, color: "#6366f1", fontFamily: "Helvetica-Bold", letterSpacing: 4, marginBottom: 20 },
  coverTitle: { fontSize: 30, color: P.white, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 10 },
  coverMeta: { fontSize: 11, color: "#a5b4fc", marginBottom: 4 },
  coverDate: { fontSize: 9, color: "#6366f1" },
  coverBadge: { display: "flex", flexDirection: "row", marginTop: 20 },
  coverBadgeText: { fontSize: 10, fontFamily: "Helvetica-Bold", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },
  body: { padding: "36 52" },
  topBar: { height: 4, backgroundColor: P.indigo, marginBottom: 28, marginHorizontal: -52 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: P.slate900, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: P.slate200 },
  kpiGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  kpiBox: { flex: 1, backgroundColor: P.slate100, borderRadius: 6, padding: "10 12", borderLeftWidth: 3 },
  kpiLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: P.slate400, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: P.slate900 },
  kpiSub: { fontSize: 7, color: P.slate400, marginTop: 2 },
  goalBox: { backgroundColor: "#f5f3ff", borderLeftWidth: 3, borderLeftColor: P.indigo, padding: "10 14", borderRadius: "0 6 6 0", marginBottom: 16 },
  goalText: { fontSize: 9.5, color: "#3730a3", fontStyle: "italic" },
  tableHdr: { flexDirection: "row", backgroundColor: P.slate900, padding: "8 10" },
  tableHdrCell: { fontSize: 7.5, color: P.white, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", padding: "6 10", borderBottomWidth: 1, borderBottomColor: P.slate200 },
  tableCell: { fontSize: 8, color: P.slate700 },
  teamGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  teamCard: { width: "30%", backgroundColor: P.slate100, borderRadius: 6, padding: "12 14", borderWidth: 1, borderColor: P.slate200 },
  teamName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: P.slate900, marginBottom: 8 },
  teamStatRow: { flexDirection: "row", justifyContent: "space-between" },
  teamStatVal: { fontSize: 14, fontFamily: "Helvetica-Bold", color: P.slate900 },
  teamStatLabel: { fontSize: 7, color: P.slate400, textTransform: "uppercase", letterSpacing: 0.5 },
  footer: { position: "absolute", bottom: 20, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: P.slate400 },
  progressTrack: { height: 10, backgroundColor: P.slate200, borderRadius: 5, marginTop: 4 },
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtMins(m: number) {
  if (m === 0) return "0h";
  const h = Math.floor(m / 60), rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function Footer({ tenant, date }: { tenant: string; date: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>CONFIDENTIAL · FORGE · {tenant}</Text>
      <Text style={s.footerText}>{date}</Text>
    </View>
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenant: string; sprintId: string }> }) {
  void req;
  const { tenant: slug, sprintId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const isAdmin = ctx.role === "owner" || ctx.role === "admin" || ctx.impersonating;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const [sprintRes, issuesRes, memberRes] = await Promise.all([
    svc.from("sprints").select("id, name, goal, start_date, end_date, status, project_id, committed_story_points, completed_story_points").eq("tenant_id", ctx.tenant.id).eq("id", sprintId).maybeSingle(),
    svc.from("issues").select("id, number, title, status, story_points, time_estimate_minutes, assignee_id").eq("tenant_id", ctx.tenant.id).eq("sprint_id", sprintId),
    svc.from("memberships").select("user:users!inner(id, name, email)").eq("tenant_id", ctx.tenant.id),
  ]);

  const sprint = sprintRes.data;
  if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

  const projectRes = await svc.from("projects").select("name, key").eq("id", sprint.project_id as string).maybeSingle();
  const project = projectRes.data;
  const issues = issuesRes.data ?? [];
  const issueIds = issues.map((i) => i.id as string);

  const userMap = new Map<string, string>();
  for (const m of memberRes.data ?? []) {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    userMap.set(u.id, u.name ?? u.email);
  }

  const timeLogs = issueIds.length > 0
    ? (await svc.from("issue_time_logs").select("issue_id, user_id, minutes").eq("tenant_id", ctx.tenant.id).in("issue_id", issueIds)).data ?? []
    : [];

  const timeByIssue = new Map<string, number>();
  const timeByUser = new Map<string, number>();
  for (const l of timeLogs) {
    const id = l.issue_id as string, uid = l.user_id as string, mins = l.minutes as number;
    timeByIssue.set(id, (timeByIssue.get(id) ?? 0) + mins);
    timeByUser.set(uid, (timeByUser.get(uid) ?? 0) + mins);
  }

  const isDone = (s: string) => s === "done" || s === "closed";
  const doneIssues = issues.filter((i) => isDone(i.status as string));
  const plannedPts = (sprint.committed_story_points as number | null) ?? issues.reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);
  const completedPts = (sprint.completed_story_points as number | null) ?? doneIssues.reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);
  const velocityPct = plannedPts > 0 ? Math.round((completedPts / plannedPts) * 100) : 0;
  const totalLogged = Array.from(timeByIssue.values()).reduce((s, v) => s + v, 0);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const statusColors: Record<string, string> = { active: P.indigo, completed: P.green, planned: P.slate600 };
  const statusColor = statusColors[sprint.status as string] ?? P.slate600;

  const assigneeStats = new Map<string, { done: number; points: number; logged: number }>();
  for (const issue of issues) {
    const uid = issue.assignee_id as string | null;
    if (!uid) continue;
    const e = assigneeStats.get(uid) ?? { done: 0, points: 0, logged: 0 };
    if (isDone(issue.status as string)) { e.done++; e.points += (issue.story_points as number | null) ?? 0; }
    e.logged += timeByIssue.get(issue.id as string) ?? 0;
    assigneeStats.set(uid, e);
  }

  const velBarWidth = 280;

  const pdf = (
    <Document title={`Sprint Report – ${sprint.name}`} author="Forge">
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <Text style={s.coverEyebrow}>FORGE · SPRINT REPORT</Text>
          <Text style={s.coverTitle}>{sprint.name as string}</Text>
          <Text style={s.coverMeta}>{project ? `${project.name} (${project.key})` : ""}</Text>
          <Text style={s.coverMeta}>{fmtDate(sprint.start_date as string | null)} – {fmtDate(sprint.end_date as string | null)}</Text>
          <View style={s.coverBadge}>
            <Text style={[s.coverBadgeText, { color: statusColor, backgroundColor: "#1e1b4b" }]}>
              {(sprint.status as string).toUpperCase()}
            </Text>
          </View>
          <Text style={[s.coverDate, { marginTop: 24 }]}>Generated {dateStr}</Text>
        </View>
      </Page>

      {/* Overview */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View style={s.topBar} />
          {sprint.goal && (
            <View style={[s.goalBox, { marginBottom: 16 }]}>
              <Text style={s.goalText}>Sprint Goal: {sprint.goal as string}</Text>
            </View>
          )}
          <Text style={s.sectionTitle}>Sprint Overview</Text>
          <View style={s.kpiGrid}>
            {[
              { label: "PLANNED PTS", value: String(plannedPts), color: P.slate700 },
              { label: "COMPLETED PTS", value: String(completedPts), color: P.indigo },
              { label: "VELOCITY", value: `${velocityPct}%`, color: velocityPct >= 80 ? P.green : velocityPct >= 50 ? P.amber : P.red },
              { label: "TIME LOGGED", value: fmtMins(totalLogged), color: P.slate700 },
              { label: "ISSUES DONE", value: `${doneIssues.length}/${issues.length}`, color: P.green },
            ].map((k) => (
              <View key={k.label} style={[s.kpiBox, { borderLeftColor: k.color }]}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>Velocity</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[s.progressTrack, { flex: 1 }]}>
              <Svg width={velBarWidth} height={10}>
                <Rect x={0} y={0} width={(Math.min(velocityPct, 100) / 100) * velBarWidth} height={10} fill={velocityPct >= 80 ? P.green : velocityPct >= 50 ? P.amber : P.red} rx={5} />
              </Svg>
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: P.indigo, width: 40 }}>{velocityPct}%</Text>
            <Text style={{ fontSize: 9, color: P.slate500 }}>{completedPts} / {plannedPts} pts</Text>
          </View>
          <Footer tenant={ctx.tenant.name} date={dateStr} />
        </View>
      </Page>

      {/* Issue Table */}
      <Page size="A4" style={s.page}>
        <View style={s.body}>
          <View style={s.topBar} />
          <Text style={s.sectionTitle}>Issues ({issues.length})</Text>
          <View style={s.tableHdr}>
            {[["Key", 1], ["Title", 4], ["Assignee", 2], ["Pts", 1], ["Logged", 1.5], ["Status", 1.5]].map(([h, flex]) => (
              <Text key={String(h)} style={[s.tableHdrCell, { flex: Number(flex) }]}>{String(h)}</Text>
            ))}
          </View>
          {issues.map((issue, i) => {
            const done = isDone(issue.status as string);
            return (
              <View key={issue.id as string} style={[s.tableRow, { backgroundColor: i % 2 === 1 ? P.slate100 : P.white }]}>
                <Text style={[s.tableCell, { flex: 1, fontFamily: "Helvetica-Oblique", fontSize: 7.5, color: P.slate500 }]}>
                  {project?.key ?? ""}-{issue.number as number}
                </Text>
                <Text style={[s.tableCell, { flex: 4, fontFamily: "Helvetica-Bold" }]}>{(issue.title as string).slice(0, 60)}</Text>
                <Text style={[s.tableCell, { flex: 2 }]}>{issue.assignee_id ? (userMap.get(issue.assignee_id as string) ?? "—") : "Unassigned"}</Text>
                <Text style={[s.tableCell, { flex: 1, textAlign: "center" }]}>{(issue.story_points as number | null) ?? "—"}</Text>
                <Text style={[s.tableCell, { flex: 1.5, textAlign: "center" }]}>{fmtMins(timeByIssue.get(issue.id as string) ?? 0)}</Text>
                <Text style={[s.tableCell, { flex: 1.5, textTransform: "capitalize", color: done ? P.green : P.slate600 }]}>
                  {(issue.status as string).replace(/_/g, " ")}
                </Text>
              </View>
            );
          })}
          <Footer tenant={ctx.tenant.name} date={dateStr} />
        </View>
      </Page>

      {/* Team breakdown */}
      {assigneeStats.size > 0 && (
        <Page size="A4" style={s.page}>
          <View style={s.body}>
            <View style={s.topBar} />
            <Text style={s.sectionTitle}>Team Breakdown</Text>
            <View style={s.teamGrid}>
              {Array.from(assigneeStats.entries()).map(([uid, stats]) => (
                <View key={uid} style={s.teamCard}>
                  <Text style={s.teamName}>{userMap.get(uid) ?? uid}</Text>
                  <View style={s.teamStatRow}>
                    {[["Done", String(stats.done)], ["Pts", String(stats.points)], ["Logged", fmtMins(stats.logged)]].map(([l, v]) => (
                      <View key={l} style={{ alignItems: "center" }}>
                        <Text style={s.teamStatVal}>{v}</Text>
                        <Text style={s.teamStatLabel}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Footer tenant={ctx.tenant.name} date={dateStr} />
          </View>
        </Page>
      )}
    </Document>
  );

  const buf = await renderToBuffer(pdf);
  const safeName = (sprint.name as string).replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sprint-report-${safeName}.pdf"`,
    },
  });
}
