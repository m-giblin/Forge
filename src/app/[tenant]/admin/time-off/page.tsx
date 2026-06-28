import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadTenantFlags } from "@/lib/services/featureFlags";
import { getAdminTimeOffAction } from "./actions";
import TimeOffClient from "./TimeOffClient";

export default async function AdminTimeOffPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const flags = await loadTenantFlags(ctx.tenant.id);
  if (!flags.ops_layer_premium) {
    return (
      <div className="text-center py-24">
        <p className="text-2xl mb-2">⭐</p>
        <p className="text-sm font-medium text-neutral-600">Time off management requires the Premium plan.</p>
      </div>
    );
  }

  const requests = await getAdminTimeOffAction(slug, "pending");
  return <TimeOffClient slug={slug} initial={requests} />;
}
