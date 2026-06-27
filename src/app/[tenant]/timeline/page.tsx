import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import { memberAvailabilityRepo } from "@/lib/repositories/memberAvailability";
import TimelineClient, {
  type TLIssue,
  type TLMember,
  type TLSprint,
  type TLDependency,
  type TLBaseline,
} from "../admin/workload/timeline/TimelineClient";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  // Members + availability
  const members = await membersRepo(svc).list(ctx.tenant.id);
  const availRows = await memberAvailabilityRepo(svc).listByTenant(ctx.tenant.id);
  const availMap = new Map(availRows.map((a) => [a.user_id, a.hours_per_week as number]));

  const tlMembers: TLMember[] = members.map((m) => {
    const fullName = m.name ?? m.email ?? "?";
    return {
      userId: m.userId,
      name: fullName,
      initials: fullName
        .split(/\s+/)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("") || "?",
      hoursPerWeek: availMap.get(m.userId) ?? 40,
    };
  });

  // Projects
  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "archived");

  const projectMap = new Map(
    (projectRows ?? []).map((p) => [
      p.id as string,
      { key: p.key as string, name: p.name as string },
    ])
  );

  // All non-done issues
  const { data: issueRows } = await svc
    .from("issues")
    .select(
      "id, number, title, status, priority, assignee_id, start_date, due_date, project_id, story_points, time_estimate_minutes"
    )
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "done")
    .order("project_id")
    .order("number");

  const tlIssues: TLIssue[] = (issueRows ?? []).map((r) => {
    const proj = projectMap.get(r.project_id as string);
    return {
      id: r.id as string,
      key: proj ? `${proj.key}-${r.number}` : String(r.number),
      title: r.title as string,
      status: r.status as TLIssue["status"],
      priority: r.priority as TLIssue["priority"],
      assigneeId: r.assignee_id as string | null,
      startDate: r.start_date as string | null,
      dueDate: r.due_date as string | null,
      projectId: r.project_id as string,
      projectKey: proj?.key ?? "",
      projectName: proj?.name ?? "",
      storyPoints: r.story_points as number | null,
      timeEstimateMinutes: r.time_estimate_minutes as number | null,
    };
  });

  // Sprints
  const today = new Date();
  const windowEnd = new Date(today);
  windowEnd.setUTCDate(today.getUTCDate() + 112);
  const windowStart = new Date(today);
  windowStart.setUTCDate(today.getUTCDate() - 28);

  const { data: sprintRows } = await svc
    .from("sprints")
    .select("id, name, project_id, start_date, end_date, status")
    .eq("tenant_id", ctx.tenant.id)
    .in("status", ["active", "planned"])
    .or(
      `start_date.lte.${windowEnd.toISOString().slice(0, 10)},end_date.gte.${windowStart.toISOString().slice(0, 10)}`
    )
    .order("start_date");

  const tlSprints: TLSprint[] = (sprintRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    projectId: s.project_id as string,
    startDate: s.start_date as string | null,
    endDate: s.end_date as string | null,
    status: s.status as TLSprint["status"],
  }));

  // Baselines
  const { data: baselineRows } = await svc
    .from("timeline_baselines")
    .select("id, name, created_at, timeline_baseline_items(issue_id, start_date, due_date)")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false });

  const tlBaselines: TLBaseline[] = (baselineRows ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    createdAt: b.created_at as string,
    items: ((b.timeline_baseline_items as { issue_id: string; start_date: string | null; due_date: string | null }[]) ?? []).map((item) => ({
      issueId: item.issue_id,
      startDate: item.start_date,
      dueDate: item.due_date,
    })),
  }));

  // Dependencies
  const { data: depRows } = await svc
    .from("issue_dependencies")
    .select("id, from_issue_id, to_issue_id, type")
    .eq("tenant_id", ctx.tenant.id);

  const issueIdSet = new Set(tlIssues.map((i) => i.id));
  const tlDeps: TLDependency[] = (depRows ?? [])
    .filter(
      (d) =>
        issueIdSet.has(d.from_issue_id as string) ||
        issueIdSet.has(d.to_issue_id as string)
    )
    .map((d) => ({
      id: d.id as string,
      fromIssueId: d.from_issue_id as string,
      toIssueId: d.to_issue_id as string,
      type: d.type as TLDependency["type"],
    }));

  return (
    <TimelineClient
      slug={slug}
      members={tlMembers}
      issues={tlIssues}
      sprints={tlSprints}
      dependencies={tlDeps}
      initialBaselines={tlBaselines}
    />
  );
}
