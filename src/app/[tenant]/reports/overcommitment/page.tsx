import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role: cross-project aggregation, explicit tenant_id filter enforces isolation (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { memberAvailabilityRepo } from "@/lib/repositories/memberAvailability";
import OvercommitmentClient, { type OvercommitmentMember } from "./OvercommitmentClient";

const MS_DAY = 24 * 60 * 60 * 1000;

export default async function OvercommitmentPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "view_reports")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const tenantId = ctx.tenant.id;

  const [sprintsRes, availabilityRows] = await Promise.all([
    svc
      .from("sprints")
      .select("id, name, start_date, end_date, project_id, projects!inner(key, name)")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    memberAvailabilityRepo(svc).listByTenant(tenantId),
  ]);

  const sprints = sprintsRes.data ?? [];

  if (sprints.length === 0) {
    const members: OvercommitmentMember[] = [];
    return (
      <main className="w-full px-6 py-8">
        <OvercommitmentClient members={members} />
      </main>
    );
  }

  const sprintIds = sprints.map((s) => s.id as string);
  const issuesRes = await svc
    .from("issues")
    .select("id, assignee_id, time_estimate_minutes, sprint_id")
    .eq("tenant_id", tenantId)
    .in("sprint_id", sprintIds)
    .not("assignee_id", "is", null);

  const issues = issuesRes.data ?? [];

  const usersRes = await svc
    .from("users")
    .select("id, name, email")
    .eq("tenant_id", tenantId);
  const userMap = new Map<string, string>(
    (usersRes.data ?? []).map((u) => [u.id as string, (u.name ?? u.email) as string]),
  );

  const availMap = new Map<string, number>(
    availabilityRows.map((a) => [a.user_id, a.hours_per_week]),
  );

  type Accumulator = {
    minutes: number;
    sprintBreakdown: Map<string, { projectKey: string; sprintName: string; minutes: number }>;
  };
  const byUser = new Map<string, Accumulator>();

  const sprintMeta = new Map<
    string,
    { projectKey: string; sprintName: string; weeks: number }
  >(
    sprints.map((s) => {
      const start = s.start_date ? new Date(s.start_date + "T00:00:00").getTime() : null;
      const end = s.end_date ? new Date(s.end_date + "T00:00:00").getTime() : null;
      const weeks =
        start != null && end != null && end > start
          ? (end - start) / (7 * MS_DAY)
          : 2;
      const proj = s.projects as unknown as { key: string; name: string };
      return [
        s.id as string,
        { projectKey: proj.key, sprintName: s.name as string, weeks },
      ];
    }),
  );

  for (const issue of issues) {
    const userId = issue.assignee_id as string;
    const sprintId = issue.sprint_id as string;
    const mins = (issue.time_estimate_minutes as number | null) ?? 0;
    const meta = sprintMeta.get(sprintId);
    if (!meta) continue;

    if (!byUser.has(userId)) {
      byUser.set(userId, { minutes: 0, sprintBreakdown: new Map() });
    }
    const acc = byUser.get(userId)!;
    acc.minutes += mins;

    const bk = sprintId + "__" + userId;
    const existing = acc.sprintBreakdown.get(bk);
    if (existing) {
      existing.minutes += mins;
    } else {
      acc.sprintBreakdown.set(bk, {
        projectKey: meta.projectKey,
        sprintName: meta.sprintName,
        minutes: mins,
      });
    }
  }

  const members: OvercommitmentMember[] = [];
  for (const [userId, acc] of byUser.entries()) {
    const name = userMap.get(userId) ?? userId;
    const hoursPerWeek = availMap.get(userId) ?? 40;

    const firstSprintId = issues.find((i) => i.assignee_id === userId)?.sprint_id as string | undefined;
    const weeks = firstSprintId ? (sprintMeta.get(firstSprintId)?.weeks ?? 2) : 2;
    const capacityHours = hoursPerWeek * weeks;
    const committedHours = acc.minutes / 60;
    const load = capacityHours > 0 ? Math.round((committedHours / capacityHours) * 100) : 0;

    const sprintList = [...acc.sprintBreakdown.values()].map((sb) => ({
      projectKey: sb.projectKey,
      sprintName: sb.sprintName,
      hours: sb.minutes / 60,
    }));

    members.push({ userId, name, committedHours, capacityHours, load, sprints: sprintList });
  }

  members.sort((a, b) => b.load - a.load);

  return (
    <main className="w-full px-6 py-8">
      <OvercommitmentClient members={members} />
    </main>
  );
}
