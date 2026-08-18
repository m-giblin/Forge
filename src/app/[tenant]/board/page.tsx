import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTenantContext } from "@/lib/auth";
import { loadBoard } from "@/lib/services/issues";
import type { Issue } from "@/lib/repositories/issues";
import { isUnassignedOverdue } from "@/lib/sla";
import { listVisibleProjects } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
import { getTenantSetting } from "@/lib/tenantSettings";
// eslint-disable-next-line no-restricted-imports -- service-role: sprint reads need cross-tenant visibility for admins (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sprintsRepo } from "@/lib/repositories/sprints";
import Board from "./Board";
import SprintPanel from "./SprintPanel";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string; sprint?: string }>;
}) {
  const { tenant: slug } = await params;
  const { project: projectKey, sprint: sprintParam } = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  // The board is per-project. Resolve which project the user is looking at.
  const visible = await listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating);
  const defaultProjectId = projectKey ? null : await getTenantSetting(ctx.tenant.id, "default_project_id");
  const current = projectKey
    ? visible.find((p) => p.key === projectKey)
    // Tenant-configured default (Admin > Projects), falling back to the
    // first project alphabetically if unset or no longer visible.
    : (defaultProjectId && visible.find((p) => p.id === defaultProjectId)) || visible[0];

  // No projects exist at all → send to projects page to create one
  if (!current) redirect(`/${slug}/projects`);

  const svc = createSupabaseServiceClient();
  const [{ issues, columnInfo, projects, statuses, priorities, types, categories, customFields, templates }, members, allSprints] =
    await Promise.all([
      loadBoard(ctx.tenant.id, ctx.impersonating, current.id),
      listMembers(ctx.tenant.id, ctx.impersonating),
      sprintsRepo(svc).listForProject(ctx.tenant.id, current.id).catch(() => []),
    ]);

  const activeSprint = allSprints.find((s) => s.status === "active") ?? null;
  const plannedSprints = allSprints.filter((s) => s.status === "planned");
  const currentSprint = activeSprint ?? plannedSprints[0] ?? null;
  const canEdit = ctx.role !== "viewer" && !ctx.impersonating;

  // Dedicated queries, not derived from `issues` above — that set is now a
  // fair-per-column PAGE for kanban display, not the full project, so it
  // can't be trusted for sprint capacity/progress math or the "add from
  // backlog" picker. Sprints and a project's unscheduled backlog are each
  // reliably small (unlike "every issue in the project"), so fetching them
  // directly and fully is cheap and keeps these numbers accurate regardless
  // of how the kanban is paginated.
  const [sprintIssuesRes, backlogIssuesRes, unassignedRes] = await Promise.all([
    currentSprint
      ? svc.from("issues").select("*").eq("tenant_id", ctx.tenant.id).eq("sprint_id", currentSprint.id).order("position", { ascending: true })
      : Promise.resolve({ data: [] as Issue[] }),
    svc.from("issues").select("*").eq("tenant_id", ctx.tenant.id).eq("project_id", current.id).is("sprint_id", null).order("position", { ascending: true }).limit(500),
    // Small, targeted query (unassigned + not done) so the "needs an owner"
    // warning is accurate project-wide, not limited to whatever page of
    // issues the kanban happened to fetch.
    svc.from("issues").select("*").eq("tenant_id", ctx.tenant.id).eq("project_id", current.id).is("assignee_id", null).neq("status", "done").order("created_at", { ascending: true }).limit(200),
  ]);
  const sprintIssues = (sprintIssuesRes.data ?? []) as Issue[];
  const backlogIssues = (backlogIssuesRes.data ?? []) as Issue[];
  const unassignedOverdue = ((unassignedRes.data ?? []) as Issue[]).filter((i) => isUnassignedOverdue(i));

  // Sprint capacity: estimated minutes vs logged minutes
  const estimatedMinutes = sprintIssues.reduce((s, i) => s + (i.time_estimate_minutes ?? 0), 0);
  const sprintIssueIds = sprintIssues.map((i) => i.id);
  let loggedMinutes = 0;
  if (sprintIssueIds.length > 0) {
    const { data: logRows } = await svc
      .from("issue_time_logs")
      .select("minutes")
      .eq("tenant_id", ctx.tenant.id)
      .in("issue_id", sprintIssueIds);
    loggedMinutes = (logRows ?? []).reduce((s, r) => s + ((r.minutes as number) ?? 0), 0);
  }

  // Sprint filter for the kanban board view
  const selectedSprint = sprintParam ? allSprints.find((s) => s.id === sprintParam) ?? null : null;
  const boardIssues = selectedSprint ? issues.filter((i) => i.sprint_id === selectedSprint.id) : issues;

  return (
    <main className="flex h-[calc(100vh-56px)] flex-col overflow-hidden md:h-screen">
      <SprintPanel
        slug={slug}
        projectId={current.id}
        activeSprint={activeSprint}
        plannedSprints={plannedSprints}
        sprintIssues={sprintIssues}
        backlogIssues={backlogIssues}
        unassignedOverdue={unassignedOverdue}
        canEdit={canEdit}
        estimatedMinutes={estimatedMinutes}
        loggedMinutes={loggedMinutes}
      />
      <Suspense fallback={null}>
      <Board
        key={current.id}
        slug={slug}
        tenantId={ctx.tenant.id}
        role={ctx.role}
        currentProject={{ id: current.id, key: current.key, name: current.name }}
        siblingProjects={visible.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
        initialIssues={boardIssues}
        columnInfo={selectedSprint ? {} : columnInfo}
        sprints={allSprints}
        currentSprint={selectedSprint}
        activeSprintId={activeSprint?.id ?? null}
        projects={projects}
        statuses={statuses}
        priorities={priorities}
        types={types}
        categories={categories}
        customFields={customFields}
        templates={templates}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email, avatarColor: m.avatarColor }))}
        meUserId={ctx.appUserId}
      />
      </Suspense>
    </main>
  );
}
