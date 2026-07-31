import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listVisibleProjects, listArchivedProjects } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
import ProjectsLanding, { type ProjectStats } from "../ProjectsLanding";

export default async function ProjectsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = (ctx.role === "owner" || ctx.role === "admin") && !ctx.impersonating;
  const [projects, archivedProjects, members] = await Promise.all([
    listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating),
    isAdmin ? listArchivedProjects(ctx.tenant.id, ctx.impersonating) : Promise.resolve([]),
    isAdmin ? listMembers(ctx.tenant.id, ctx.impersonating) : Promise.resolve([]),
  ]);

  const projectIds = projects.map((p) => p.id);
  const stats: Record<string, ProjectStats> = {};
  if (projectIds.length > 0) {
    const supabase = await createSupabaseServerClient();
    const [issuesRes, membersRes] = await Promise.all([
      supabase.from("issues").select("project_id, status").eq("tenant_id", ctx.tenant.id).in("project_id", projectIds),
      supabase.from("project_members").select("project_id").eq("tenant_id", ctx.tenant.id).in("project_id", projectIds),
    ]);
    for (const id of projectIds) stats[id] = { total: 0, done: 0, blocked: 0, members: 0 };
    for (const row of issuesRes.data ?? []) {
      const s = stats[row.project_id];
      if (!s) continue;
      s.total++;
      if (row.status === "done") s.done++;
      if (row.status === "blocked") s.blocked++;
    }
    for (const row of membersRes.data ?? []) {
      if (stats[row.project_id]) stats[row.project_id].members++;
    }
  }

  return (
    <main className="w-full px-6 py-8">
      <ProjectsLanding
        slug={slug}
        tenantName={ctx.tenant.name}
        isAdmin={isAdmin}
        canCreate={isAdmin}
        projects={projects}
        archivedProjects={archivedProjects}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
        stats={stats}
      />
    </main>
  );
}
