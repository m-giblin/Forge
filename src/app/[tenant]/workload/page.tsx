import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import { memberAvailabilityRepo } from "@/lib/repositories/memberAvailability";
import { INACTIVE_ISSUE_PROJECT_STATUSES } from "@/lib/repositories/projects";
import WorkloadHeatmapClient, { type HeatMember, type HeatIssue } from "./WorkloadHeatmapClient";

export default async function WorkloadPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  // Members + availability
  const memberRows = await membersRepo(svc).list(ctx.tenant.id);
  const availRows = await memberAvailabilityRepo(svc).listByTenant(ctx.tenant.id);
  const availMap = new Map(availRows.map((a) => [a.user_id, a.hours_per_week as number]));

  const members: HeatMember[] = memberRows.map((m) => {
    const name = m.name ?? m.email ?? "?";
    return {
      userId: m.userId,
      name,
      initials: name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?",
      hoursPerWeek: availMap.get(m.userId) ?? 40,
    };
  });

  // Projects — FORGE-190: closed/archived projects drop off the workload view entirely.
  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .not("status", "in", `(${INACTIVE_ISSUE_PROJECT_STATUSES.join(",")})`);

  const projectMap = new Map(
    (projectRows ?? []).map((p) => [p.id as string, { key: p.key as string, name: p.name as string }])
  );
  const activeProjectIds = [...projectMap.keys()];

  // All non-done issues with dates (16 weeks window)
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - 14);
  const windowEnd = new Date();
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 98); // 14 weeks forward

  // Only start_date OR due_date is required, not both — most real issues only
  // carry a due date. Requiring both here made this view empty for any tenant
  // that doesn't fill in start_date, which is most of them. Windowing is done
  // in JS below rather than via chained .or() filters — those don't compose
  // the way you'd expect in PostgREST and silently dropped nearly all rows.
  const windowStartIso = windowStart.toISOString().slice(0, 10);
  const windowEndIso = windowEnd.toISOString().slice(0, 10);

  const { data: issueRows } = await svc
    .from("issues")
    .select("id, number, title, status, priority, assignee_id, start_date, due_date, project_id, time_estimate_minutes, story_points")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "done")
    .in("project_id", activeProjectIds)
    .order("start_date");

  const issues: HeatIssue[] = (issueRows ?? [])
    .filter((r) => r.start_date || r.due_date)
    .map((r) => {
      const proj = projectMap.get(r.project_id as string);
      // Fill in whichever date is missing from the other — a single-day
      // placement is the honest fallback, matching how Timeline treats
      // issues with only one date set.
      const startDate = (r.start_date as string | null) ?? (r.due_date as string);
      const dueDate = (r.due_date as string | null) ?? (r.start_date as string);
      return {
        id: r.id as string,
        key: proj ? `${proj.key}-${r.number}` : String(r.number),
        title: r.title as string,
        status: r.status as HeatIssue["status"],
        priority: r.priority as HeatIssue["priority"],
        assigneeId: r.assignee_id as string | null,
        startDate,
        dueDate,
        projectId: r.project_id as string,
        projectName: proj?.name ?? "",
        timeEstimateMinutes: r.time_estimate_minutes as number | null,
        storyPoints: r.story_points as number | null,
      };
    })
    // Keep only issues that overlap the visible 16-week window.
    .filter((i) => i.dueDate >= windowStartIso && i.startDate <= windowEndIso);

  return (
    <WorkloadHeatmapClient
      slug={slug}
      members={members}
      issues={issues}
    />
  );
}
