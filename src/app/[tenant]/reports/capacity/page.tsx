import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import CapacityClient from "./CapacityClient";

export default async function CapacityPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  const [
    { data: sprintRows },
    { data: availRows },
    { data: memberRows },
  ] = await Promise.all([
    svc
      .from("sprints")
      .select("id, name, start_date, end_date, project_id, issues(id, story_points, time_estimate_minutes, assignee_id)")
      .eq("tenant_id", ctx.tenant.id)
      .eq("status", "active"),
    svc
      .from("member_availability")
      .select("user_id, hours_per_week, work_days")
      .eq("tenant_id", ctx.tenant.id),
    svc
      .from("memberships")
      .select("user_id, users!inner(id, name)")
      .eq("tenant_id", ctx.tenant.id),
  ]);

  const availMap = new Map<string, number>(
    (availRows ?? []).map((a) => [a.user_id as string, a.hours_per_week as number])
  );
  const userMap = new Map<string, string>(
    (memberRows ?? []).map((m) => {
      const u = m.users as unknown as { id: string; name: string };
      return [m.user_id as string, u.name];
    })
  );

  function sprintWeeks(start: string | null, end: string | null): number {
    if (!start || !end) return 2;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
  }

  const sprints = (sprintRows ?? []).map((s) => {
    const issues = (s.issues as unknown as Array<{
      id: string;
      story_points: number | null;
      time_estimate_minutes: number | null;
      assignee_id: string | null;
    }>) ?? [];

    const weeks = sprintWeeks(s.start_date as string | null, s.end_date as string | null);

    const committedHours = issues.reduce(
      (sum, i) => sum + (i.time_estimate_minutes ?? 0) / 60,
      0
    );
    const committedPoints = issues.reduce(
      (sum, i) => sum + (i.story_points ?? 0),
      0
    );

    const memberLoadsMap = new Map<string, number>();
    for (const issue of issues) {
      if (issue.assignee_id) {
        const prev = memberLoadsMap.get(issue.assignee_id) ?? 0;
        memberLoadsMap.set(issue.assignee_id, prev + (issue.time_estimate_minutes ?? 0) / 60);
      }
    }

    const memberLoads = Array.from(userMap.entries()).map(([userId, name]) => {
      const cap = (availMap.get(userId) ?? 40) * weeks;
      const committed = memberLoadsMap.get(userId) ?? 0;
      return { userId, name, capacityHours: cap, committedHours: committed };
    });

    const totalCapacityHours = memberLoads.reduce((s, m) => s + m.capacityHours, 0);

    return {
      id: s.id as string,
      name: s.name as string,
      committedHours,
      committedPoints,
      totalCapacityHours,
      memberLoads,
    };
  });

  return <CapacityClient slug={slug} sprints={sprints} />;
}
