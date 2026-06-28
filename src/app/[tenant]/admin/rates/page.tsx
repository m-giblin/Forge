import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import { getBillingRatesAction, getCostRatesAction, getRateMembersAndProjectsAction } from "./actions";
import RatesClient from "./RatesClient";

export default async function AdminRatesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.ops_layer_premium) {
    return (
      <div className="text-center py-24">
        <p className="text-2xl mb-2">⭐</p>
        <p className="text-sm font-medium text-neutral-600">Billing and cost rates require the Premium plan.</p>
      </div>
    );
  }

  const [billing, cost, { members, projects }] = await Promise.all([
    getBillingRatesAction(slug),
    getCostRatesAction(slug),
    getRateMembersAndProjectsAction(slug),
  ]);

  return (
    <RatesClient
      slug={slug}
      initialBilling={billing}
      initialCost={cost}
      members={members}
      projects={projects}
    />
  );
}
