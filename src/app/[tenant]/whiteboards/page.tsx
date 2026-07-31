import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { listVisibleProjects } from "@/lib/services/projects";

/**
 * Whiteboards is project-scoped, same situation as Mind Map — jump straight to
 * the first visible project's Whiteboards tab instead of Projects Hub.
 */
export default async function WhiteboardsEntryPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);

  const projects = await listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating);
  if (projects.length === 0) redirect(`/${slug}/projects`);

  redirect(`/${slug}/projects/${projects[0].key}?tab=whiteboards`);
}
