import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- print route: service-role required, tenant context verified (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
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

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ProjectReportPage({
  params,
}: {
  params: Promise<{ tenant: string; projectId: string }>;
}) {
  const { tenant: slug, projectId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && !ctx.impersonating) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();

  const { data: project } = await svc
    .from("projects")
    .select("id, name, key, status, start_date, end_date, budget_cents, budget_alert_threshold_pct")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", projectId)
    .maybeSingle();

  if (!project) redirect(`/${slug}/projects`);

  const { data: sprintRow } = await svc
    .from("sprints")
    .select("id, name, goal, start_date, end_date, committed_story_points, completed_story_points")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();

  const activeSprint = sprintRow ?? null;

  const { data: issueRows } = await svc
    .from("issues")
    .select("id, status, sprint_id, created_at, priority, assignee_id, title, number")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", projectId);

  const issues = issueRows ?? [];
  const openIssues = issues.filter((i) => i.status !== "done" && i.status !== "closed");
  const inProgressIssues = issues.filter((i) => i.status === "in_progress");
  const doneThisSprint = activeSprint
    ? issues.filter((i) => i.sprint_id === activeSprint.id && (i.status === "done" || i.status === "closed"))
    : [];
  const backlogIssues = issues.filter((i) => !i.sprint_id);

  const risks = issues
    .filter(
      (i) =>
        (i.priority === "urgent" || i.priority === "high") &&
        i.status !== "done" &&
        i.status !== "closed"
    )
    .slice(0, 3);

  let spendCents = 0;
  if (project.budget_cents) {
    const { data: timeLogs } = await svc
      .from("issue_time_logs")
      .select("minutes, hourly_rate_cents")
      .eq("tenant_id", ctx.tenant.id)
      .in(
        "issue_id",
        issues.map((i) => i.id)
      );
    for (const log of timeLogs ?? []) {
      if (log.hourly_rate_cents) {
        spendCents += Math.round(((log.minutes as number) / 60) * (log.hourly_rate_cents as number));
      }
    }
  }

  const members = await membersRepo(svc).list(ctx.tenant.id);

  const userMap = new Map(members.map((m) => [m.userId, m.name ?? m.email]));

  const now = new Date();
  const generatedAt = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const daysLeft = daysUntil(project.end_date as string | null);
  const budgetPct =
    project.budget_cents && project.budget_cents > 0
      ? Math.round((spendCents / (project.budget_cents as number)) * 100)
      : null;

  const sprintDone = activeSprint?.completed_story_points ?? 0;
  const sprintTotal = activeSprint?.committed_story_points ?? 0;
  const sprintPct = sprintTotal > 0 ? Math.round((sprintDone / sprintTotal) * 100) : 0;
  const sprintDaysLeft = daysUntil(activeSprint?.end_date ?? null);

  const budgetBarColor =
    budgetPct === null ? "#6366f1"
    : budgetPct > 90 ? "#ef4444"
    : budgetPct > 70 ? "#f97316"
    : "#22c55e";

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
                Forge · Project Status Report
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                {project.name as string}
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                <span style={{ fontFamily: "monospace" }}>{project.key as string}</span>
                {" · "}
                <span style={{ textTransform: "capitalize" }}>{project.status as string}</span>
                {project.start_date ? ` · Started ${fmtDate(project.start_date as string)}` : ""}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Generated {generatedAt}</p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
          {[
            { label: "Open Issues", value: String(openIssues.length) },
            { label: "In Progress", value: String(inProgressIssues.length) },
            { label: "Done This Sprint", value: String(doneThisSprint.length) },
            {
              label: "Days to Deadline",
              value: daysLeft === null ? "No deadline" : daysLeft < 0 ? "Overdue" : `${daysLeft}d`,
              color: daysLeft !== null && daysLeft < 7 ? "#dc2626" : daysLeft !== null && daysLeft < 14 ? "#d97706" : "#0f172a",
            },
          ].map((tile) => (
            <div key={tile.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 6px" }}>{tile.label}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: tile.color ?? "#0f172a", margin: 0, lineHeight: 1 }}>{tile.value}</p>
            </div>
          ))}
        </div>

        {project.budget_cents ? (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Budget</h2>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "#475569" }}>
                  Spent: <strong>${(spendCents / 100).toLocaleString()}</strong> of ${((project.budget_cents as number) / 100).toLocaleString()}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: budgetBarColor }}>{budgetPct}% used</span>
              </div>
              <div style={{ width: "100%", background: "#e2e8f0", borderRadius: 4, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(budgetPct ?? 0, 100)}%`, height: "100%", background: budgetBarColor, borderRadius: 4 }} />
              </div>
              {project.budget_alert_threshold_pct && (
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                  Alert threshold: {project.budget_alert_threshold_pct}%
                </p>
              )}
            </div>
          </section>
        ) : null}

        {activeSprint && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Active Sprint</h2>
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>{activeSprint.name as string}</p>
                  {activeSprint.goal && (
                    <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{activeSprint.goal as string}</p>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 12, color: "#0369a1", fontWeight: 600, margin: 0 }}>
                    {sprintDaysLeft !== null ? `${sprintDaysLeft}d remaining` : ""}
                  </p>
                  <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
                    {fmtDate(activeSprint.start_date as string | null)} – {fmtDate(activeSprint.end_date as string | null)}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, background: "#e0f2fe", borderRadius: 4, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${sprintPct}%`, height: "100%", background: "#0284c7", borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0284c7", minWidth: 40 }}>{sprintPct}%</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{sprintDone}/{sprintTotal} pts</span>
              </div>
            </div>
          </section>
        )}

        {risks.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Top Risks</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1e293b", color: "#fff" }}>
                  {["Key", "Title", "Priority", "Assignee", "Age"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risks.map((r, i) => (
                  <tr key={r.id as string} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11 }}>
                      {project.key as string}-{r.number as number}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{r.title as string}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: r.priority === "urgent" ? "#fef2f2" : "#fff7ed",
                        color: r.priority === "urgent" ? "#dc2626" : "#c2410c",
                      }}>
                        {r.priority as string}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>
                      {r.assignee_id ? (userMap.get(r.assignee_id as string) ?? "—") : "Unassigned"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b" }}>{daysSince(r.created_at as string)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {members.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Team</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {members.map((m) => {
                const initials = (m.name ?? m.email ?? "?")
                  .split(/\s+/)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .slice(0, 2)
                  .join("");
                return (
                  <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#e0e7ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {initials || "?"}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>{m.name ?? m.email}</p>
                      <p style={{ fontSize: 11, color: "#64748b", margin: 0, textTransform: "capitalize" }}>{m.role}</p>
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
