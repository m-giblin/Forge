import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role required: workspace-wide aggregate view, not scoped to caller's own issues (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import { INACTIVE_ISSUE_PROJECT_STATUSES } from "@/lib/repositories/projects";
import DashboardsClient, { type StatCard, type StatusSlice, type ThroughputDay, type WorkloadRow } from "./DashboardsClient";

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  blocked: "Blocked",
  done: "Done",
};

const STATUS_COLOR: Record<string, string> = {
  backlog: "#a19d90",
  todo: "#3a6ea8",
  in_progress: "#c9791d",
  in_review: "#7a4fa0",
  blocked: "#c0392b",
  done: "#3f7d4c",
};

const STATUS_ORDER = ["backlog", "todo", "in_progress", "in_review", "blocked", "done"];

export default async function DashboardsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();

  const [projectRows, memberRows] = await Promise.all([
    svc.from("projects").select("id").eq("tenant_id", ctx.tenant.id).not("status", "in", `(${INACTIVE_ISSUE_PROJECT_STATUSES.join(",")})`),
    membersRepo(svc).list(ctx.tenant.id),
  ]);

  const activeProjectIds = (projectRows.data ?? []).map((p) => p.id as string);

  const { data: issueRows } = activeProjectIds.length
    ? await svc
        .from("issues")
        .select("id, status, assignee_id, updated_at")
        .eq("tenant_id", ctx.tenant.id)
        .in("project_id", activeProjectIds)
    : { data: [] };

  const issues = issueRows ?? [];
  const total = issues.length;

  // ---- Stat row ----
  const countOf = (s: string) => issues.filter((i) => i.status === s).length;
  const statCards: StatCard[] = [
    { label: "Open", value: countOf("todo") + countOf("backlog") },
    { label: "In Progress", value: countOf("in_progress") + countOf("in_review") },
    { label: "Blocked", value: countOf("blocked") },
    { label: "Done", value: countOf("done") },
  ];

  // ---- Status breakdown ----
  const statusDistribution: StatusSlice[] = STATUS_ORDER.filter((s) => countOf(s) > 0).map((s) => ({
    label: STATUS_LABEL[s] ?? s,
    count: countOf(s),
    pct: total > 0 ? Math.round((countOf(s) / total) * 100) : 0,
    color: STATUS_COLOR[s] ?? "#a19d90",
  }));

  // ---- Throughput: issues completed per day, last 14 days ----
  const days: ThroughputDay[] = [];
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  for (let offset = 13; offset >= 0; offset--) {
    const day = new Date(todayUtc);
    day.setUTCDate(day.getUTCDate() - offset);
    const dayEnd = new Date(day);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const count = issues.filter((i) => {
      if (i.status !== "done") return false;
      const u = new Date(i.updated_at as string);
      return u >= day && u < dayEnd;
    }).length;
    days.push({ label: day.toLocaleDateString(undefined, { weekday: "short" }), count });
  }
  const maxDayCount = Math.max(1, ...days.map((d) => d.count));

  // ---- Team workload ----
  // Deliberately a raw active-issue count, not a "% of capacity" figure: most issues in this
  // dataset have no time estimate or story points, so a manufactured capacity percentage would
  // be precision the data doesn't support (early testing surfaced this producing meaningless
  // 999%-capped values). Active issue count is the real, honest number available today.
  const activeIssues = issues.filter((i) => i.status !== "done" && i.assignee_id);
  const workloadRows: WorkloadRow[] = memberRows
    .map((m) => {
      const mine = activeIssues.filter((i) => i.assignee_id === m.userId);
      const name = m.name ?? m.email ?? "?";
      return {
        userId: m.userId,
        name,
        initials: name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?",
        activeCount: mine.length,
        blockedCount: mine.filter((i) => i.status === "blocked").length,
      };
    })
    .filter((r) => r.activeCount > 0)
    .sort((a, b) => b.activeCount - a.activeCount);

  return (
    <DashboardsClient
      slug={slug}
      statCards={statCards}
      statusDistribution={statusDistribution}
      throughputDays={days}
      maxDayCount={maxDayCount}
      workloadRows={workloadRows}
    />
  );
}
