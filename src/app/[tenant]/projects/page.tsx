import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listVisibleProjects } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
import ProjectsLanding from "../ProjectsLanding";

// Projects list + create-project intake. Previously the tenant home; now reached
// from the "Projects" nav link and from Mission Control's portfolio section.
export default async function ProjectsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const [projects, members] = await Promise.all([
    listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating),
    isAdmin ? listMembers(ctx.tenant.id, ctx.impersonating) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <ProjectsLanding
        slug={slug}
        tenantName={ctx.tenant.name}
        canCreate={isAdmin && !ctx.impersonating}
        projects={projects}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
      />
    </main>
  );
}
