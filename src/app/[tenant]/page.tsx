import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listVisibleProjects } from "@/lib/services/projects";
import { listMembers } from "@/lib/services/members";
import ProjectsLanding from "./ProjectsLanding";

// Tenant landing page: the projects this user can see. Admins see all; everyone
// else sees the projects whose team they're on. Click a project -> its board.
export default async function TenantHome({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const [projects, members] = await Promise.all([
    listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating),
    // Member list powers the "Owner" picker on the intake form (admins only need it).
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
