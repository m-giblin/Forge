import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadMissionControl, type ScopeKey } from "@/lib/services/missionControl";
import MissionControl from "./MissionControl";

// Tenant landing = Mission Control: the post-login hub. Real data from the issue
// database (attention queue, throughput, portfolio). The projects list lives at
// /<tenant>/projects now.
export default async function TenantHome({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { tenant: slug } = await params;
  const { scope: scopeParam } = await searchParams;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const scope: ScopeKey = scopeParam === "team" ? "team" : "mine";
  const data = await loadMissionControl({
    tenantId: ctx.tenant.id,
    appUserId: ctx.appUserId,
    role: ctx.role,
    email: ctx.email,
    impersonating: ctx.impersonating,
    scope,
  });

  return <MissionControl slug={slug} data={data} />;
}
