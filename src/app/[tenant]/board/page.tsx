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
  searchParams: Promise<{ project?: string }>;
}) {
  const { tenant: slug } = await params;
  const { project: projectKey } = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  // The board is per-project. Resolve which project the user is looking at.
  const visible = await listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating);
  const current = projectKey
    ? visible.find((p) => p.key === projectKey)
    : visible.length === 1
      ? visible[0]
      : undefined;

  // No project resolved → send the user to the landing page to pick one
  // (or create one, if there are none). Avoids the old "dumped into a board
  // with no project" dead-end.
  if (!current) redirect(`/${slug}`);

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

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <SprintPanel
        slug={slug}
        projectId={current.id}
        activeSprint={activeSprint}
        plannedSprints={plannedSprints}
        sprintIssues={sprintIssues}
        backlogIssues={backlogIssues}
        canEdit={canEdit}
      />
      <Suspense fallback={null}>
      <Board
        slug={slug}
        tenantId={ctx.tenant.id}
        role={ctx.role}
        currentProject={{ id: current.id, key: current.key, name: current.name }}
        siblingProjects={visible.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
        initialIssues={issues}
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
