import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadTenantFlags } from "@/lib/services/featureFlags";

// Gate the Projects area (list + project portal) behind the project_portal flag.
export default async function ProjectsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.project_portal) redirect(`/${slug}/coming-soon?f=project_portal`);
  return <>{children}</>;
}
