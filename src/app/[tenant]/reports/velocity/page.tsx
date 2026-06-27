import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import VelocityClient from "./VelocityClient";

export default async function VelocityPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const svc = createSupabaseServiceClient();

  const { data: sprintRows } = await svc
    .from("sprints")
    .select("id, name, project_id, projects!inner(id, name)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("status", "completed")
    .order("end_date", { ascending: false })
    .limit(10);

  if (!sprintRows || sprintRows.length === 0) {
    return (
      <VelocityClient
        slug={slug}
        sprints={[]}
      />
    );
  }

  const sprintIds = sprintRows.map((s) => s.id as string);

  const [{ data: issueRows }, { data: timeRows }] = await Promise.all([
    svc
      .from("issues")
      .select("sprint_id, story_points, status")
      .eq("tenant_id", ctx.tenant.id)
      .in("sprint_id", sprintIds),
    svc
      .from("issue_time_logs")
      .select("minutes, issues!inner(sprint_id)")
      .eq("tenant_id", ctx.tenant.id)
      .in("issues.sprint_id", sprintIds),
  ]);

  const issues = issueRows ?? [];
  const timeLogs = timeRows ?? [];

  const sprints = sprintRows.map((s) => {
    const sid = s.id as string;
    const sprintIssues = issues.filter((i) => i.sprint_id === sid);
    const plannedPoints = sprintIssues.reduce((sum, i) => sum + (i.story_points ?? 0), 0);
    const completedPoints = sprintIssues
      .filter((i) => i.status === "done")
      .reduce((sum, i) => sum + (i.story_points ?? 0), 0);
    const loggedMinutes = timeLogs
      .filter((t) => (t.issues as unknown as { sprint_id: string } | null)?.sprint_id === sid)
      .reduce((sum, t) => sum + (t.minutes ?? 0), 0);
    const totalIssues = sprintIssues.length;
    const doneIssues = sprintIssues.filter((i) => i.status === "done").length;
    const proj = s.projects as unknown as { id: string; name: string };
    return {
      id: sid,
      name: s.name as string,
      projectId: s.project_id as string,
      projectName: proj.name,
      plannedPoints,
      completedPoints,
      loggedMinutes,
      totalIssues,
      doneIssues,
    };
  });

  return <VelocityClient slug={slug} sprints={sprints} />;
}
