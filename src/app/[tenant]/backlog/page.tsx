import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role read: cross-status backlog view for a picked project (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";
import { membersRepo } from "@/lib/repositories/members";
import BacklogClient from "./BacklogClient";

export default async function BacklogPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .eq("is_system_fallback", false)
    .not("status", "eq", "archived")
    .order("name");

  const projects = (projectRows ?? []) as { id: string; key: string; name: string }[];
  const projectId = sp.project && projects.some((p) => p.id === sp.project) ? sp.project : (projects[0]?.id ?? "");

  const options = await fieldConfigRepo(svc).listOptions(ctx.tenant.id);
  // Same "backlog = lowest position, ready = next one up" logic as Backlog Refinement —
  // dynamic, not hardcoded to a status literally named "backlog".
  const statusOptions = options
    .filter((o) => o.field === "status" && o.key !== "done")
    .sort((a, b) => a.position - b.position);
  const backlogStatus = statusOptions[0] ?? null;
  const readyStatus = statusOptions[1] ?? null;
  const types = options.filter((o) => o.field === "type").sort((a, b) => a.position - b.position);
  const priorities = options.filter((o) => o.field === "priority").sort((a, b) => a.position - b.position);

  // Unscheduled (no sprint yet) and not done — the same definition Sprint Planning's
  // "backlog candidates" and Board's own "Backlog (unscheduled)" section already use.
  // Epic grouping isn't possible here: epics link to issues only via sprint_id -> sprints.epic_id,
  // so an unscheduled issue structurally has no epic yet. Grouping by status instead — the
  // axis that's actually meaningful for "what's stuck and where."
  const { data: issueRows } = projectId
    ? await svc
        .from("issues")
        .select("id, number, title, status, type, priority, assignee_id, story_points")
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", projectId)
        .is("sprint_id", null)
        .neq("status", "done")
        .order("position")
    : { data: [] };

  const memberRows = await membersRepo(svc).list(ctx.tenant.id);
  const members = memberRows.map((m) => ({ userId: m.userId, label: m.name || m.email }));

  return (
    <main className="flex min-h-[calc(100vh-56px)] w-full flex-col md:min-h-screen">
      <BacklogClient
        slug={slug}
        projects={projects}
        projectId={projectId}
        statusOptions={statusOptions.map((s) => ({ key: s.key, label: s.label }))}
        backlogStatusKey={backlogStatus?.key ?? null}
        readyStatus={readyStatus ? { key: readyStatus.key, label: readyStatus.label } : null}
        types={types.map((t) => ({ key: t.key, label: t.label }))}
        priorities={priorities.map((p) => ({ key: p.key, label: p.label, color: p.color }))}
        members={members}
        issues={(issueRows ?? []).map((i) => ({
          id: i.id as string,
          number: i.number as number,
          title: i.title as string,
          status: i.status as string,
          type: i.type as string,
          priority: i.priority as string,
          assigneeId: i.assignee_id as string | null,
          storyPoints: i.story_points as number | null,
        }))}
      />
    </main>
  );
}
