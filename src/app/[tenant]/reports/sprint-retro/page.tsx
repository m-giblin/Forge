import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import RetroClient from "./RetroClient";

export default async function SprintRetroPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ sprintId?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  const { data: sprintRows } = await svc
    .from("sprints")
    .select("id, name, project_id, projects!inner(key, name)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "completed")
    .order("end_date", { ascending: false })
    .limit(20);

  const sprints = (sprintRows ?? []).map((s) => {
    const proj = s.projects as unknown as { key: string; name: string };
    return {
      id: s.id as string,
      name: s.name as string,
      projectId: s.project_id as string,
      projectName: proj.name,
      projectKey: proj.key,
    };
  });

  const selectedSprintId = sp.sprintId ?? sprints[0]?.id ?? null;

  if (!selectedSprintId) {
    return <RetroClient slug={slug} sprints={[]} selectedSprintId={null} issues={[]} />;
  }

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  const { data: issueRows } = await svc
    .from("issues")
    .select("id, number, title, assignee_id, time_estimate_minutes, users!left(id, name)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("sprint_id", selectedSprintId);

  const issueIds = (issueRows ?? []).map((i) => i.id as string);

  const { data: timeLogRows } = issueIds.length > 0
    ? await svc
        .from("issue_time_logs")
        .select("issue_id, minutes")
        .eq("tenant_id", ctx.tenant.id)
        .in("issue_id", issueIds)
    : { data: [] };

  const logMap = new Map<string, number>();
  for (const t of timeLogRows ?? []) {
    const prev = logMap.get(t.issue_id as string) ?? 0;
    logMap.set(t.issue_id as string, prev + (t.minutes as number));
  }

  const issues = (issueRows ?? []).map((i) => {
    const assigneeUser = i.users as unknown as { id: string; name: string } | null;
    return {
      id: i.id as string,
      key: `${selectedSprint?.projectKey ?? "?"}-${i.number}`,
      title: i.title as string,
      assigneeName: assigneeUser?.name ?? "Unassigned",
      estimateMinutes: (i.time_estimate_minutes as number | null) ?? 0,
      loggedMinutes: logMap.get(i.id as string) ?? 0,
    };
  });

  return (
    <RetroClient
      slug={slug}
      sprints={sprints}
      selectedSprintId={selectedSprintId}
      issues={issues}
    />
  );
}
