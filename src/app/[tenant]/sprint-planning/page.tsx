import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";
import SprintPlanningClient from "./SprintPlanningClient";

export default async function SprintPlanningPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string; sprint?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!ctxCanDo(ctx, "manage_sprints")) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();

  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .not("status", "eq", "archived")
    .order("name");

  const projects = (projectRows ?? []) as { id: string; key: string; name: string }[];
  const projectId = sp.project && projects.some((p) => p.id === sp.project) ? sp.project : (projects[0]?.id ?? "");

  const { data: sprintRows } = projectId
    ? await svc
        .from("sprints")
        .select("id, name, status, start_date, end_date")
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", projectId)
        .eq("status", "planned")
        .order("start_date")
    : { data: [] };

  const plannedSprints = (sprintRows ?? []) as { id: string; name: string; status: string; start_date: string; end_date: string }[];
  const sprintId = sp.sprint && plannedSprints.some((s) => s.id === sp.sprint) ? sp.sprint : (plannedSprints[0]?.id ?? "");

  // Backlog candidates: unscheduled (no sprint), not a terminal ("done"-like) status — same
  // definition the Board's own "Backlog (unscheduled)" section already uses.
  const options = await fieldConfigRepo(svc).listOptions(ctx.tenant.id);
  const statusOptions = options.filter((o) => o.field === "status");
  const terminalKeys = new Set(statusOptions.filter((s) => s.is_terminal).map((s) => s.key));
  const priorities = options.filter((o) => o.field === "priority").sort((a, b) => a.position - b.position);

  const { data: candidateRows } = projectId
    ? await svc
        .from("issues")
        .select("id, number, title, status, priority, story_points")
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", projectId)
        .is("sprint_id", null)
        .order("position")
    : { data: [] };

  const candidates = ((candidateRows ?? []) as { id: string; number: number; title: string; status: string; priority: string; story_points: number | null }[])
    .filter((i) => !terminalKeys.has(i.status));

  const committed = sprintId
    ? await svc.from("issues").select("id, number, title, priority, story_points").eq("tenant_id", ctx.tenant.id).eq("sprint_id", sprintId)
    : { data: [] };

  // Team capacity: average completed points across the last up to 3 completed
  // sprints for this project — the same real number the Velocity report already
  // computes, reused as the planning baseline. NOT derived from
  // member_availability.hours_per_week — there's no honest hours-to-points
  // conversion rate anywhere in this data model, so that would be fabricated
  // precision (see Docs/design-gaps.md burnup/workload writeups for the same call).
  const { data: pastSprintRows } = projectId
    ? await svc
        .from("sprints")
        .select("id")
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("end_date", { ascending: false })
        .limit(3)
    : { data: [] };

  const pastSprintIds = (pastSprintRows ?? []).map((s) => s.id as string);
  let capacity: number | null = null;
  if (pastSprintIds.length > 0) {
    const { data: pastIssueRows } = await svc
      .from("issues")
      .select("sprint_id, story_points, status")
      .eq("tenant_id", ctx.tenant.id)
      .in("sprint_id", pastSprintIds);
    const bySprintDone = new Map<string, number>();
    for (const i of pastIssueRows ?? []) {
      if (!terminalKeys.has(i.status as string)) continue;
      const sid = i.sprint_id as string;
      bySprintDone.set(sid, (bySprintDone.get(sid) ?? 0) + ((i.story_points as number | null) ?? 0));
    }
    const perSprint = pastSprintIds.map((id) => bySprintDone.get(id) ?? 0);
    capacity = Math.round((perSprint.reduce((s, v) => s + v, 0) / perSprint.length) * 10) / 10;
  }

  return (
    <main className="w-full px-6 py-8">
      <SprintPlanningClient
        slug={slug}
        projects={projects}
        projectId={projectId}
        plannedSprints={plannedSprints}
        sprintId={sprintId}
        candidates={candidates.map((c) => ({ id: c.id, number: c.number, title: c.title, priority: c.priority, storyPoints: c.story_points }))}
        committed={((committed.data ?? []) as { id: string; number: number; title: string; priority: string; story_points: number | null }[]).map((c) => ({
          id: c.id, number: c.number, title: c.title, priority: c.priority, storyPoints: c.story_points,
        }))}
        priorities={priorities.map((p) => ({ key: p.key, label: p.label, color: p.color }))}
        capacity={capacity}
        completedSprintCount={pastSprintIds.length}
      />
    </main>
  );
}
