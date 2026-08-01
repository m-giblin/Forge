import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { projectsRepo } from "@/lib/repositories/projects";
import { listProjectTeam } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PageHeader from "@/components/patterns/PageHeader";
import ProjectTeamsManager from "./ProjectTeamsManager";

export default async function AdminProjectsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");

  const client = ctx.impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  const [projects, members] = await Promise.all([
    projectsRepo(client).listByTenant(ctx.tenant.id),
    listMembers(ctx.tenant.id, ctx.impersonating),
  ]);

  // Each project's current team (small N of projects — fine to fan out).
  const teams = await Promise.all(
    projects.map(async (p) => ({
      projectId: p.id,
      memberIds: (await listProjectTeam(ctx.tenant.id, p.id, ctx.impersonating)).map((m) => m.userId),
    }))
  );
  const teamMap = Object.fromEntries(teams.map((t) => [t.projectId, t.memberIds]));

  return (
    <div className="space-y-6">
      <PageHeader title="Projects & Teams" subtitle="Who can see and edit each project" />
      <div className="px-6">
        <ProjectTeamsManager
          slug={slug}
          readOnly={readOnly}
          projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
          members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
          teamMap={teamMap}
        />
      </div>
    </div>
  );
}
