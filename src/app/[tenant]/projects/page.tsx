import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listVisibleProjects, listArchivedProjects } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
import ProjectsLanding from "../ProjectsLanding";

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
      />
    </main>
  );
}
