import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import { memberAvailabilityRepo } from "@/lib/repositories/memberAvailability";
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

  // Projects
  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "archived");

  const projectMap = new Map(
    (projectRows ?? []).map((p) => [p.id as string, { key: p.key as string, name: p.name as string }])
  );

  // All non-done issues with dates (16 weeks window)
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - 14);
  const windowEnd = new Date();
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 98); // 14 weeks forward

  const { data: issueRows } = await svc
    .from("issues")
    .select("id, number, title, status, priority, assignee_id, start_date, due_date, project_id, time_estimate_minutes, story_points")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "done")
    .not("start_date", "is", null)
    .not("due_date", "is", null)
    .gte("due_date", windowStart.toISOString().slice(0, 10))
    .lte("start_date", windowEnd.toISOString().slice(0, 10))
    .order("start_date");

  const issues: HeatIssue[] = (issueRows ?? []).map((r) => {
    const proj = projectMap.get(r.project_id as string);
    return {
      id: r.id as string,
      key: proj ? `${proj.key}-${r.number}` : String(r.number),
      title: r.title as string,
      status: r.status as HeatIssue["status"],
      priority: r.priority as HeatIssue["priority"],
      assigneeId: r.assignee_id as string | null,
      startDate: r.start_date as string,
      dueDate: r.due_date as string,
      projectId: r.project_id as string,
      projectName: proj?.name ?? "",
      timeEstimateMinutes: r.time_estimate_minutes as number | null,
      storyPoints: r.story_points as number | null,
    };
  });

  return (
    <WorkloadHeatmapClient
      slug={slug}
      members={members}
      issues={issues}
    />
  );
}
