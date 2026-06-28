import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin report: service-role required, tenant context verified (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import { memberAvailabilityRepo } from "@/lib/repositories/memberAvailability";
import WorkloadReport from "./WorkloadReport";
import type { WorkloadMember } from "../WorkloadClient";

export default async function WorkloadReportPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && !ctx.impersonating) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();

  const { data: sprintRows } = await svc
    .from("sprints")
    .select("id, name, start_date, end_date, project_id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  const activeSprints = sprintRows ?? [];
  const activeSprintIds = activeSprints.map((s) => s.id as string);
  const primarySprint = activeSprints[0] ?? null;

  const members = await membersRepo(svc).list(ctx.tenant.id);
  const availabilityRows = await memberAvailabilityRepo(svc).listByTenant(ctx.tenant.id);
  const availMap = new Map(availabilityRows.map((a) => [a.user_id, a.hours_per_week]));

  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const mondayIso = monday.toISOString();

  const { data: timeLogs } = await svc
    .from("issue_time_logs")
    .select("user_id, minutes")
    .eq("tenant_id", ctx.tenant.id)
    .gte("logged_at", mondayIso);

  const loggedMap = new Map<string, number>();
  for (const row of timeLogs ?? []) {
    const uid = row.user_id as string;
    loggedMap.set(uid, (loggedMap.get(uid) ?? 0) + (row.minutes as number));
  }

  const estimatedMap = new Map<string, number>();
  const issueCountMap = new Map<string, number>();

  if (activeSprintIds.length > 0) {
    const { data: issueRows } = await svc
      .from("issues")
      .select("assignee_id, time_estimate_minutes")
      .eq("tenant_id", ctx.tenant.id)
      .in("sprint_id", activeSprintIds)
      .not("assignee_id", "is", null);

    for (const row of issueRows ?? []) {
      const uid = row.assignee_id as string;
      estimatedMap.set(uid, (estimatedMap.get(uid) ?? 0) + ((row.time_estimate_minutes as number | null) ?? 0));
      issueCountMap.set(uid, (issueCountMap.get(uid) ?? 0) + 1);
    }
  }

  const workloadMembers: WorkloadMember[] = members.map((m) => {
    const hoursPerWeek = availMap.get(m.userId) ?? 40;
    const initials = (m.name ?? m.email ?? "?")
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("");

    return {
      userId: m.userId,
      name: m.name ?? m.email,
      role: m.role,
      avatarInitials: initials || "?",
      availableMinutesWeek: hoursPerWeek * 60,
      loggedMinutesWeek: loggedMap.get(m.userId) ?? 0,
      estimatedMinutesSprint: estimatedMap.get(m.userId) ?? 0,
      assignedIssueCount: issueCountMap.get(m.userId) ?? 0,
      hoursPerWeek,
    };
  });

  const activeSprint = primarySprint
    ? {
        name: primarySprint.name as string,
        start_date: primarySprint.start_date as string | null,
        end_date: primarySprint.end_date as string | null,
      }
    : null;

  return (
    <WorkloadReport
      members={workloadMembers}
      activeSprint={activeSprint}
      workspaceName={ctx.tenant.name}
      weekStartIso={mondayIso}
      generatedAt={now.toISOString()}
    />
  );
}
