import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import CalendarClient, { type CalIssue, type CalSprint, type CalMember } from "./CalendarClient";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  // Members
  const memberRows = await membersRepo(svc).list(ctx.tenant.id);
  const members: CalMember[] = memberRows.map((m) => {
    const name = m.name ?? m.email ?? "?";
    return {
      userId: m.userId,
      name,
      initials: name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?",
    };
  });

  // Projects for color/key
  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .neq("status", "archived");

  const projectMap = new Map(
    (projectRows ?? []).map((p) => [p.id as string, { key: p.key as string, name: p.name as string }])
  );

  // Issues with dates (3 months back, 6 months forward)
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 3);
  const rangeEnd = new Date();
  rangeEnd.setMonth(rangeEnd.getMonth() + 6);

  const { data: issueRows } = await svc
    .from("issues")
    .select("id, number, title, status, priority, assignee_id, start_date, due_date, project_id")
    .eq("tenant_id", ctx.tenant.id)
    .or(`due_date.gte.${rangeStart.toISOString().slice(0, 10)},start_date.gte.${rangeStart.toISOString().slice(0, 10)}`)
    .lte("due_date", rangeEnd.toISOString().slice(0, 10))
    .order("due_date", { ascending: true });

  const issues: CalIssue[] = (issueRows ?? []).map((r) => {
    const proj = projectMap.get(r.project_id as string);
    return {
      id: r.id as string,
      key: proj ? `${proj.key}-${r.number}` : String(r.number),
      title: r.title as string,
      status: r.status as CalIssue["status"],
      priority: r.priority as CalIssue["priority"],
      assigneeId: r.assignee_id as string | null,
      startDate: r.start_date as string | null,
      dueDate: r.due_date as string | null,
      projectId: r.project_id as string,
    };
  });

  // Sprints
  const { data: sprintRows } = await svc
    .from("sprints")
    .select("id, name, project_id, start_date, end_date, status")
    .eq("tenant_id", ctx.tenant.id)
    .in("status", ["active", "planned"])
    .gte("end_date", rangeStart.toISOString().slice(0, 10))
    .lte("start_date", rangeEnd.toISOString().slice(0, 10))
    .order("start_date");

  const sprints: CalSprint[] = (sprintRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    projectId: s.project_id as string,
    startDate: s.start_date as string | null,
    endDate: s.end_date as string | null,
    status: s.status as CalSprint["status"],
  }));

  return (
    <CalendarClient
      slug={slug}
      members={members}
      issues={issues}
      sprints={sprints}
    />
  );
}
