import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { listActiveEstimationSessions } from "@/lib/services/estimationPoker";
import EstimationPokerLanding from "./EstimationPokerLanding";

export default async function EstimationPokerPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (ctx.role === "viewer") redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const { data: projectRows } = await svc
    .from("projects")
    .select("id, key, name")
    .eq("tenant_id", ctx.tenant.id)
    .not("status", "eq", "archived")
    .order("name");

  const projects = (projectRows ?? []) as { id: string; key: string; name: string }[];
  const projectId = sp.project && projects.some((p) => p.id === sp.project) ? sp.project : (projects[0]?.id ?? "");

  const activeSessions = projectId ? await listActiveEstimationSessions(ctx.tenant.id, projectId) : [];

  const unestimatedRes = projectId
    ? await svc.from("issues").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant.id).eq("project_id", projectId).is("story_points", null)
    : { count: 0 };

  return (
    <main className="w-full">
      <EstimationPokerLanding
        slug={slug}
        projects={projects}
        projectId={projectId}
        activeSessions={activeSessions.map((s) => ({ id: s.id, createdAt: s.created_at }))}
        unestimatedCount={unestimatedRes.count ?? 0}
      />
    </main>
  );
}
