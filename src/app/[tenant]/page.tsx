import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadTenantFlags } from "@/lib/services/featureFlags";

// Tenant home → Morning Briefing (role-aware "Good Morning" dashboard).
// Dashboards feature flag off → fall back to board (bug-tracker mode).
// Mission Control is still accessible at /<tenant>/mission-control.
export default async function TenantHome({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.dashboards) redirect(`/${slug}/board`);

  redirect(`/${slug}/morning`);
}
