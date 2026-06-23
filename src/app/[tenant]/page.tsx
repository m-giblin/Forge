import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadMissionControl, type ScopeKey } from "@/lib/services/missionControl";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import { listMembers } from "@/lib/services/members";
import MissionControl from "./MissionControl";

// Tenant landing = Mission Control: the post-login hub. Real data from the issue
// database (attention queue, throughput, portfolio). The projects list lives at
// /<tenant>/projects now.
export default async function TenantHome({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ scope?: string; project?: string }>;
}) {
  const { tenant: slug } = await params;
  const { scope: scopeParam, project: projectParam } = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  // Dashboards gated off → the workspace home is the board (bug-tracker mode).
  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.dashboards) redirect(`/${slug}/board`);

  const scope: ScopeKey = scopeParam === "team" ? "team" : "mine";
  const [data, memberRows] = await Promise.all([
    loadMissionControl({
      tenantId: ctx.tenant.id,
      appUserId: ctx.appUserId,
      role: ctx.role,
      email: ctx.email,
      impersonating: ctx.impersonating,
      scope,
      projectKey: scopeParam === "team" && typeof projectParam === "string" ? projectParam : undefined,
    }),
    listMembers(ctx.tenant.id, ctx.impersonating),
  ]);

  const members = memberRows.map((m) => ({ userId: m.userId, label: m.name || m.email }));

  return <MissionControl slug={slug} data={data} members={members} />;
}
