import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role required: reads across all of the caller's own projects for a personal stat rollup (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function percentileAvg(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  return Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 10) / 10;
}

export default async function MyContributionPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const me = ctx.appUserId;

  const { data: projectRows } = await svc.from("projects").select("id").eq("tenant_id", ctx.tenant.id).neq("status", "archived");
  const projectIds = (projectRows ?? []).map((p) => p.id as string);

  // Active sprint(s) across my projects
  const { data: activeSprintRows } = projectIds.length
    ? await svc.from("sprints").select("id").eq("tenant_id", ctx.tenant.id).in("project_id", projectIds).eq("status", "active")
    : { data: [] };
  const activeSprintIds = new Set((activeSprintRows ?? []).map((s) => s.id as string));

  // My issues assigned across active projects
  const { data: myIssueRows } = projectIds.length
    ? await svc
        .from("issues")
        .select("id, status, story_points, sprint_id, created_at")
        .eq("tenant_id", ctx.tenant.id)
        .in("project_id", projectIds)
        .eq("assignee_id", me)
    : { data: [] };
  const myIssues = myIssueRows ?? [];

  const doneThisSprint = myIssues.filter((i) => i.status === "done" && i.sprint_id && activeSprintIds.has(i.sprint_id as string));
  const pointsThisSprint = doneThisSprint.reduce((s, i) => s + ((i.story_points as number | null) ?? 0), 0);

  // My open PRs (same real-data proxy as the Code Review queue: issue's assignee = PR owner)
  const myIssueIds = myIssues.map((i) => i.id as string);
  const { data: prRows } = myIssueIds.length
    ? await svc
        .from("issue_code_links")
        .select("id")
        .eq("tenant_id", ctx.tenant.id)
        .in("issue_id", myIssueIds)
        .neq("link_kind", "commit")
        .eq("pr_state", "open")
    : { data: [] };
  const myOpenPrCount = (prRows ?? []).length;

  // My avg cycle time, last 90 days — same calculation as /reports/cycle-time, scoped to me
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 90);
  const { data: doneIssueRows } = projectIds.length
    ? await svc
        .from("issues")
        .select("id, created_at")
        .eq("tenant_id", ctx.tenant.id)
        .in("project_id", projectIds)
        .eq("assignee_id", me)
        .in("status", ["done", "closed"])
        .gte("created_at", from.toISOString())
    : { data: [] };
  const doneIssues = doneIssueRows ?? [];
  const doneIssueIds = doneIssues.map((i) => i.id as string);

  const { data: doneEvents } = doneIssueIds.length
    ? await svc
        .from("issue_events")
        .select("issue_id, created_at")
        .eq("tenant_id", ctx.tenant.id)
        .eq("field", "status")
        .in("new_value", ["done", "closed"])
        .in("issue_id", doneIssueIds)
        .order("created_at", { ascending: true })
    : { data: [] };
  const resolvedAt = new Map<string, string>();
  for (const ev of doneEvents ?? []) {
    if (!resolvedAt.has(ev.issue_id as string)) resolvedAt.set(ev.issue_id as string, ev.created_at as string);
  }
  const cycleDays = doneIssues
    .map((i) => {
      const res = resolvedAt.get(i.id as string);
      if (!res) return null;
      return Math.max(0, (new Date(res).getTime() - new Date(i.created_at as string).getTime()) / 86400000);
    })
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const avgCycleDays = percentileAvg(cycleDays);

  const stats = [
    { label: "Issues done this sprint", value: String(doneThisSprint.length) },
    { label: "Points contributed", value: String(pointsThisSprint) },
    { label: "My open PRs", value: String(myOpenPrCount) },
    { label: "My avg cycle time", value: cycleDays.length ? `${avgCycleDays}d` : "—" },
  ];

  return (
    <main className="w-full px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">My Contribution</h1>
        <p className="mt-1 text-sm text-neutral-500">Your personal stats across every project — active sprint and last 90 days.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-neutral-900">{s.value}</div>
          </div>
        ))}
      </div>
      {cycleDays.length === 0 && (
        <p className="mt-4 text-xs text-neutral-400">Cycle time needs at least one issue you resolved in the last 90 days to compute.</p>
      )}
    </main>
  );
}
