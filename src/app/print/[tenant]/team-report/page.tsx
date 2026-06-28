import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- print route: service-role required, tenant context verified (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import AutoPrint from "./AutoPrint";

function fmtMins(m: number): string {
  if (m === 0) return "0h";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getUTCDay();
  const daysBack = day === 0 ? 6 : day - 1;
  copy.setUTCDate(copy.getUTCDate() - daysBack);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export default async function TeamReportPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && !ctx.impersonating) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const now = new Date();
  const monday = mondayOf(now);
  const mondayIso = monday.toISOString();

  const firstOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString();

  const members = await membersRepo(svc).list(ctx.tenant.id);

  const { data: weekLogs } = await svc
    .from("issue_time_logs")
    .select("user_id, minutes")
    .eq("tenant_id", ctx.tenant.id)
    .gte("logged_at", mondayIso);

  const weekByUser = new Map<string, number>();
  for (const log of weekLogs ?? []) {
    const uid = log.user_id as string;
    weekByUser.set(uid, (weekByUser.get(uid) ?? 0) + (log.minutes as number));
  }

  const { data: monthLogs } = await svc
    .from("issue_time_logs")
    .select("user_id, minutes")
    .eq("tenant_id", ctx.tenant.id)
    .gte("logged_at", firstOfMonth);

  const monthByUser = new Map<string, number>();
  for (const log of monthLogs ?? []) {
    const uid = log.user_id as string;
    monthByUser.set(uid, (monthByUser.get(uid) ?? 0) + (log.minutes as number));
  }

  const { data: activeSprints } = await svc
    .from("sprints")
    .select("id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "active");

  const activeSprintIds = (activeSprints ?? []).map((s) => s.id as string);

  const issueCountByUser = new Map<string, number>();
  if (activeSprintIds.length > 0) {
    const { data: sprintIssues } = await svc
      .from("issues")
      .select("assignee_id")
      .eq("tenant_id", ctx.tenant.id)
      .in("sprint_id", activeSprintIds)
      .not("assignee_id", "is", null);
    for (const issue of sprintIssues ?? []) {
      const uid = issue.assignee_id as string;
      issueCountByUser.set(uid, (issueCountByUser.get(uid) ?? 0) + 1);
    }
  }

  const { data: projects } = await svc
    .from("projects")
    .select("id, name, budget_cents")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "active")
    .not("budget_cents", "is", null);

  const projectBudgets: Array<{ id: string; name: string; budget: number; spend: number }> = [];
  for (const proj of projects ?? []) {
    const { data: allIssues } = await svc
      .from("issues")
      .select("id")
      .eq("tenant_id", ctx.tenant.id)
      .eq("project_id", proj.id as string);
    const issueIds = (allIssues ?? []).map((i) => i.id as string);
    let spend = 0;
    if (issueIds.length > 0) {
      const { data: logs } = await svc
        .from("issue_time_logs")
        .select("minutes, hourly_rate_cents")
        .eq("tenant_id", ctx.tenant.id)
        .in("issue_id", issueIds);
      for (const log of logs ?? []) {
        if (log.hourly_rate_cents) {
          spend += Math.round(((log.minutes as number) / 60) * (log.hourly_rate_cents as number));
        }
      }
    }
    projectBudgets.push({ id: proj.id as string, name: proj.name as string, budget: proj.budget_cents as number, spend });
  }

  const { data: weekIssueTimeLogs } = await svc
    .from("issue_time_logs")
    .select("issue_id, minutes")
    .eq("tenant_id", ctx.tenant.id)
    .gte("logged_at", mondayIso);

  const weekTimeByIssue = new Map<string, number>();
  for (const log of weekIssueTimeLogs ?? []) {
    const iid = log.issue_id as string;
    weekTimeByIssue.set(iid, (weekTimeByIssue.get(iid) ?? 0) + (log.minutes as number));
  }

  const topIssueIds = Array.from(weekTimeByIssue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  type TopIssue = { id: string; number: number; title: string; projectName: string; projectKey: string; logged: number };
  let topIssues: TopIssue[] = [];
  if (topIssueIds.length > 0) {
    const { data: issueRows } = await svc
      .from("issues")
      .select("id, number, title, project_id")
      .in("id", topIssueIds);
    const projectIds = [...new Set((issueRows ?? []).map((i) => i.project_id as string))];
    const { data: projRows } = await svc
      .from("projects")
      .select("id, name, key")
      .in("id", projectIds);
    const projMap = new Map((projRows ?? []).map((p) => [p.id as string, { name: p.name as string, key: p.key as string }]));
    topIssues = (issueRows ?? []).map((issue) => ({
      id: issue.id as string,
      number: issue.number as number,
      title: issue.title as string,
      projectName: projMap.get(issue.project_id as string)?.name ?? "—",
      projectKey: projMap.get(issue.project_id as string)?.key ?? "—",
      logged: weekTimeByIssue.get(issue.id as string) ?? 0,
    })).sort((a, b) => b.logged - a.logged);
  }

  const generatedAt = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const weekLabel = monday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  function utilColor(weekMins: number): string {
    const h = weekMins / 60;
    if (h > 44) return "#dc2626";
    if (h > 36) return "#d97706";
    if (h > 20) return "#15803d";
    return "#94a3b8";
  }

  return (
    <>
      <style>{`
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { margin: 1.2cm 1.5cm; size: A4; } }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
      `}</style>
      <AutoPrint />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 40px 80px", color: "#1e293b", lineHeight: 1.5 }}>
        <div style={{ borderBottom: "3px solid #1e293b", paddingBottom: 24, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
                Forge · Team Report
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                Week of {weekLabel}
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{ctx.tenant.name}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>Generated {generatedAt}</p>
            </div>
          </div>
        </div>

        {projectBudgets.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Budget Overview</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1e293b", color: "#fff" }}>
                  {["Project", "Budget", "Spent", "% Used"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectBudgets.map((pb, i) => {
                  const pct = pb.budget > 0 ? Math.round((pb.spend / pb.budget) * 100) : 0;
                  const pctColor = pct > 90 ? "#dc2626" : pct > 70 ? "#d97706" : "#15803d";
                  return (
                    <tr key={pb.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>{pb.name}</td>
                      <td style={{ padding: "10px 12px", color: "#475569" }}>${(pb.budget / 100).toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", color: "#475569" }}>${(pb.spend / 100).toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: pctColor }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Team Time</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#fff" }}>
                {["Member", "This Week", "This Month", "Sprint Issues"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const weekMins = weekByUser.get(m.userId) ?? 0;
                const monthMins = monthByUser.get(m.userId) ?? 0;
                const sprintCount = issueCountByUser.get(m.userId) ?? 0;
                const color = utilColor(weekMins);
                return (
                  <tr key={m.userId} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>{m.name ?? m.email}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color }}>{fmtMins(weekMins)}</td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{fmtMins(monthMins)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#475569" }}>{sprintCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {topIssues.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Most Time-Intensive Issues This Week</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1e293b", color: "#fff" }}>
                  {["Key", "Title", "Project", "Time Logged"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topIssues.map((issue, i) => (
                  <tr key={issue.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>
                      {issue.projectKey}-{issue.number}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{issue.title}</td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>{issue.projectName}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#6366f1" }}>{fmtMins(issue.logged)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            <strong style={{ color: "#475569" }}>CONFIDENTIAL</strong> — Generated by Forge-Worx · {ctx.tenant.name}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>{generatedAt}</div>
        </div>
      </div>
    </>
  );
}
