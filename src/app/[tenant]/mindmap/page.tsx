import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listVisibleProjects } from "@/lib/services/projects";

/**
 * Mind Map is project-scoped (Epic → Sprint → Issue within one project), so this
 * top-level nav entry can't render it directly. Jump straight to the first visible
 * project's Mind Map tab instead of landing on Projects Hub and making the user
 * click through — same project ordering Projects Hub itself uses, so this is
 * whichever project would appear first there anyway.
 */
export default async function MindMapEntryPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const projects = await listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating);
  if (projects.length === 0) redirect(`/${slug}/projects`);

  redirect(`/${slug}/projects/${projects[0].key}/mindmap`);
}
