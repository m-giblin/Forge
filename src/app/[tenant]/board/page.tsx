import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadBoard, BOARD_LIMIT } from "@/lib/services/issues";
import { listVisibleProjects } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
import Board from "./Board";

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

  const [{ issues, total, projects, statuses, priorities, types, categories, customFields }, members] =
    await Promise.all([
      loadBoard(ctx.tenant.id, ctx.impersonating, current.id),
      listMembers(ctx.tenant.id, ctx.impersonating),
    ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
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
    </main>
  );
}
