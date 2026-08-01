import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: admin page loads git connection (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { gitIntegrationRepo } from "@/lib/repositories/gitIntegration";
import { projectsRepo } from "@/lib/repositories/projects";
import GitSettingsClient from "./GitSettingsClient";
import AdminTable from "@/components/patterns/admin/AdminTable";

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

  // Recent deployments (post-migration 0091)
  const { data: deployments } = await svc
    .from("deployments")
    .select("id, environment, version, repo_full_name, deployed_by, status, commit_sha, deployed_at")
    .eq("tenant_id", ctx.tenant.id)
    .order("deployed_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6 pb-8">
      <GitSettingsClient
        slug={slug}
        connection={connection}
        repoLinks={repoLinks}
        projects={projects}
        webhookUrl={webhookUrl}
      />

      {/* Deployment history — populated after migration 0091 */}
      <div className="px-6">
        <h3 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Recent deployments</h3>
        {!deployments || deployments.length === 0 ? (
          <div className="fw-card border-dashed p-6 text-center text-[11.5px] text-[#a19d90]">
            No deployments recorded yet. Connect GitHub and push a release tag or use the Deployments API.
          </div>
        ) : (
          <AdminTable
            columns={[
              { label: "Version", width: 120 },
              { label: "Environment", width: 120 },
              { label: "Deployed by", flex: true },
              { label: "Status", width: 100 },
              { label: "When", width: 140 },
            ]}
            rows={(deployments ?? []).map((d: {
              id: string; environment: string; version: string; repo_full_name: string | null;
              deployed_by: string | null; status: string; commit_sha: string | null; deployed_at: string;
            }) => [
              { kind: "mono", value: d.version },
              { kind: "dim", value: d.environment },
              { kind: "dim", value: d.deployed_by ?? "—" },
              {
                kind: "chip",
                value: d.status,
                chipFg: d.status === "success" ? "#3f7d4c" : d.status === "failure" ? "#c0392b" : "#c9791d",
                chipBg: d.status === "success" ? "#e9f3ea" : d.status === "failure" ? "#fbeae8" : "#fdf1de",
              },
              {
                kind: "dim",
                value: new Date(d.deployed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
              },
            ])}
          />
        )}
      </div>
    </div>
  );
}
