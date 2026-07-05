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

  // Recent deployments (post-migration 0091)
  const { data: deployments } = await svc
    .from("deployments")
    .select("id, environment, version, repo_full_name, deployed_by, status, commit_sha, deployed_at")
    .eq("tenant_id", ctx.tenant.id)
    .order("deployed_at", { ascending: false })
    .limit(20);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <GitSettingsClient
        slug={slug}
        connection={connection}
        repoLinks={repoLinks}
        projects={projects}
        webhookUrl={webhookUrl}
      />

      {/* Deployment history — populated after migration 0091 */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Recent deployments</h3>
        {!deployments || deployments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
            No deployments recorded yet. Connect GitHub and push a release tag or use the Deployments API.
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Version</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Environment</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Deployed by</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-neutral-500">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-neutral-500 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {(deployments ?? []).map((d: {
                  id: string; environment: string; version: string; repo_full_name: string | null;
                  deployed_by: string | null; status: string; commit_sha: string | null; deployed_at: string;
                }) => (
                  <tr key={d.id} className="hover:bg-neutral-50 transition">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-neutral-900">{d.version}</td>
                    <td className="px-4 py-2.5 text-xs text-neutral-500">{d.environment}</td>
                    <td className="px-4 py-2.5 text-xs text-neutral-500">{d.deployed_by ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        d.status === "success" ? "bg-green-50 text-green-700" :
                        d.status === "failure" ? "bg-red-50 text-red-700" :
                        "bg-amber-50 text-amber-700"
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-neutral-400 text-right">
                      {new Date(d.deployed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
