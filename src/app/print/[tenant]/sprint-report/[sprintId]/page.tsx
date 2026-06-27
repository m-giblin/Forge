import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- print route: service-role required, tenant context verified (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import AutoPrint from "./AutoPrint";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMins(m: number): string {
  if (m === 0) return "0h";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export default async function SprintReportPage({
  params,
}: {
  params: Promise<{ tenant: string; sprintId: string }>;
}) {
  const { tenant: slug, sprintId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && !ctx.impersonating) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();

  const { data: sprint } = await svc
    .from("sprints")
    .select("id, name, goal, start_date, end_date, status, project_id, committed_story_points, completed_story_points")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", sprintId)
    .maybeSingle();

  if (!sprint) redirect(`/${slug}/board`);

  const { data: projectRow } = await svc
    .from("projects")
    .select("name, key")
    .eq("id", sprint.project_id as string)
    .maybeSingle();

  const { data: issueRows } = await svc
    .from("issues")
    .select("id, number, title, status, story_points, time_estimate_minutes, assignee_id, resolved_at, created_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("sprint_id", sprintId);

  const issues = issueRows ?? [];
  const issueIds = issues.map((i) => i.id as string);

  const { data: timeLogs } = issueIds.length > 0
    ? await svc
        .from("issue_time_logs")
        .select("issue_id, user_id, minutes")
        .eq("tenant_id", ctx.tenant.id)
        .in("issue_id", issueIds)
    : { data: [] };

  const timeByIssue = new Map<string, number>();
  const timeByUser = new Map<string, number>();
  for (const log of timeLogs ?? []) {
    const iid = log.issue_id as string;
    const uid = log.user_id as string;
    timeByIssue.set(iid, (timeByIssue.get(iid) ?? 0) + (log.minutes as number));
    timeByUser.set(uid, (timeByUser.get(uid) ?? 0) + (log.minutes as number));
  }

  const { data: memberRows } = await svc
    .from("memberships")
    .select("user:users!inner(id, name, email)")
    .eq("tenant_id", ctx.tenant.id);

  const userMap = new Map<string, string>();
  for (const m of memberRows ?? []) {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    userMap.set(u.id, u.name ?? u.email);
  }

  const assigneeSet = new Map<string, { done: number; points: number; logged: number }>();
  for (const issue of issues) {
    const uid = issue.assignee_id as string | null;
    if (!uid) continue;
    const entry = assigneeSet.get(uid) ?? { done: 0, points: 0, logged: 0 };
    if (issue.status === "done" || issue.status === "closed") {
      entry.done += 1;
      entry.points += (issue.story_points as number | null) ?? 0;
    }
    entry.logged += timeByIssue.get(issue.id as string) ?? 0;
    assigneeSet.set(uid, entry);
  }

  const plannedPts = (sprint.committed_story_points as number | null) ?? issues.reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);
  const completedPts = (sprint.completed_story_points as number | null) ?? issues.filter((i) => i.status === "done" || i.status === "closed").reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);
  const velocityPct = plannedPts > 0 ? Math.round((completedPts / plannedPts) * 100) : 0;
  const totalLogged = Array.from(timeByIssue.values()).reduce((s, v) => s + v, 0);
  const doneCount = issues.filter((i) => i.status === "done" || i.status === "closed").length;

  const now = new Date();
  const generatedAt = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const statusBg: Record<string, string> = {
    active: "#dbeafe",
    completed: "#dcfce7",
    planned: "#f1f5f9",
  };
  const statusText: Record<string, string> = {
    active: "#1d4ed8",
    completed: "#15803d",
    planned: "#475569",
  };

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
                Forge · Sprint Report
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                {sprint.name as string}
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                {projectRow ? `${projectRow.name} (${projectRow.key})` : ""} · {fmtDate(sprint.start_date as string | null)} – {fmtDate(sprint.end_date as string | null)}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: statusBg[sprint.status as string] ?? "#f1f5f9",
                color: statusText[sprint.status as string] ?? "#475569",
              }}>
                {(sprint.status as string).charAt(0).toUpperCase() + (sprint.status as string).slice(1)}
              </span>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Generated {generatedAt}</p>
            </div>
          </div>
        </div>

        {sprint.goal && (
          <div style={{ borderLeft: "4px solid #6366f1", padding: "12px 16px", background: "#f5f3ff", borderRadius: "0 8px 8px 0", marginBottom: 32, fontStyle: "italic", color: "#3730a3", fontSize: 14 }}>
            {sprint.goal as string}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 40 }}>
          {[
            { label: "Planned Pts", value: String(plannedPts) },
            { label: "Completed Pts", value: String(completedPts) },
            { label: "Velocity", value: `${velocityPct}%`, color: velocityPct >= 80 ? "#15803d" : velocityPct >= 50 ? "#d97706" : "#dc2626" },
            { label: "Time Logged", value: fmtMins(totalLogged) },
            { label: "Issues Done", value: `${doneCount}/${issues.length}` },
          ].map((tile) => (
            <div key={tile.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 6px" }}>{tile.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: tile.color ?? "#0f172a", margin: 0, lineHeight: 1 }}>{tile.value}</p>
            </div>
          ))}
        </div>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Velocity</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, position: "relative", height: 28 }}>
              <div style={{ position: "absolute", inset: 0, background: "#e2e8f0", borderRadius: 4 }} />
              <div style={{ position: "absolute", inset: 0, width: `${Math.min(velocityPct, 100)}%`, background: "#6366f1", borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#4f46e5", minWidth: 50 }}>{velocityPct}%</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>{completedPts} / {plannedPts} pts</span>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Issues</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#fff" }}>
                {["Key", "Title", "Assignee", "Points", "Time Logged", "Status"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, i) => {
                const isDone = issue.status === "done" || issue.status === "closed";
                return (
                  <tr
                    key={issue.id as string}
                    style={{
                      background: isDone ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>
                      {projectRow?.key ?? ""}-{issue.number as number}
                    </td>
                    <td style={{ padding: "9px 12px", fontWeight: 500 }}>{issue.title as string}</td>
                    <td style={{ padding: "9px 12px", color: "#64748b" }}>
                      {issue.assignee_id ? (userMap.get(issue.assignee_id as string) ?? "—") : "Unassigned"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "center", color: "#475569" }}>
                      {(issue.story_points as number | null) ?? "—"}
                    </td>
                    <td style={{ padding: "9px 12px", color: "#475569" }}>
                      {fmtMins(timeByIssue.get(issue.id as string) ?? 0)}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 600,
                        background: isDone ? "#dcfce7" : "#f1f5f9",
                        color: isDone ? "#15803d" : "#475569",
                        textTransform: "capitalize",
                      }}>
                        {(issue.status as string).replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {assigneeSet.size > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Team Breakdown</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {Array.from(assigneeSet.entries()).map(([uid, stats]) => {
                const initials = (userMap.get(uid) ?? "?")
                  .split(/\s+/)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .slice(0, 2)
                  .join("");
                return (
                  <div key={uid} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e0e7ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                        {initials}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>{userMap.get(uid) ?? uid}</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
                      {[
                        { label: "Done", value: String(stats.done) },
                        { label: "Points", value: String(stats.points) },
                        { label: "Logged", value: fmtMins(stats.logged) },
                      ].map((s) => (
                        <div key={s.label}>
                          <p style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>{s.value}</p>
                          <p style={{ fontSize: 10, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
