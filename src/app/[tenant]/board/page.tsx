import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTenantContext } from "@/lib/auth";
import { loadBoard, BOARD_LIMIT } from "@/lib/services/issues";
import { listVisibleProjects } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
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
  const current = projectKey
    ? visible.find((p) => p.key === projectKey)
    : visible[0]; // auto-select first project so Board always loads directly

  // No projects exist at all → send to projects page to create one
  if (!current) redirect(`/${slug}/projects`);

  const svc = createSupabaseServiceClient();
  const [{ issues, total, projects, statuses, priorities, types, categories, customFields }, members, allSprints] =
    await Promise.all([
      loadBoard(ctx.tenant.id, ctx.impersonating, current.id),
      listMembers(ctx.tenant.id, ctx.impersonating),
      sprintsRepo(svc).listForProject(ctx.tenant.id, current.id).catch(() => []),
    ]);

  const activeSprint = allSprints.find((s) => s.status === "active") ?? null;
  const plannedSprints = allSprints.filter((s) => s.status === "planned");
  const currentSprint = activeSprint ?? plannedSprints[0] ?? null;
  const sprintIssues = currentSprint ? issues.filter((i) => i.sprint_id === currentSprint.id) : [];
  const backlogIssues = issues.filter((i) => !i.sprint_id);
  const canEdit = ctx.role !== "viewer" && !ctx.impersonating;

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
    <main className="px-2 py-4">
      {activeSprint && (
        <div className="flex justify-end mb-2">
          <a
            href={`/${slug}/board/export/sprint-pdf/${activeSprint.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition shadow-sm"
          >
            <span>📄</span>
            Export Sprint Report
          </a>
        </div>
      )}
      <SprintPanel
        slug={slug}
        projectId={current.id}
        activeSprint={activeSprint}
        plannedSprints={plannedSprints}
        sprintIssues={sprintIssues}
        backlogIssues={backlogIssues}
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
        sprints={allSprints}
        currentSprint={selectedSprint}
        total={total}
        issueLimit={BOARD_LIMIT}
        projects={projects}
        statuses={statuses}
        priorities={priorities}
        types={types}
        categories={categories}
        customFields={customFields}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
      />
      </Suspense>
    </main>
  );
}
