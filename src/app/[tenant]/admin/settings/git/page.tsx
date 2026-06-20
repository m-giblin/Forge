import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: admin page loads git connection (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { gitIntegrationRepo } from "@/lib/repositories/gitIntegration";
import { projectsRepo } from "@/lib/repositories/projects";
import GitSettingsClient from "./GitSettingsClient";

export default async function GitSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const [connection, projects] = await Promise.all([
    gitIntegrationRepo(svc).getConnection(ctx.tenant.id).catch(() => null),
    projectsRepo(svc).listByTenant(ctx.tenant.id).catch(() => []),
  ]);

  const repoLinks = connection
    ? await gitIntegrationRepo(svc).listRepoLinks(ctx.tenant.id).catch(() => [])
    : [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  const webhookUrl = `${appUrl}/api/v1/webhooks/github?tenant=${slug}`;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <GitSettingsClient
        slug={slug}
        connection={connection}
        repoLinks={repoLinks}
        projects={projects}
        webhookUrl={webhookUrl}
      />
    </div>
  );
}
