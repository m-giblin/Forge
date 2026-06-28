import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import BillingClient from "./BillingClient";

export default async function BillingPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const { data: tenantData } = await svc
    .from("tenants")
    .select("name, subscription_status, subscription_tier, subscription_seats, trial_started_at, trial_ends_at")
    .eq("id", ctx.tenant.id)
    .single();

  if (!tenantData) redirect("/");

  const isOwner = ctx.role === "owner";

  return (
    <main className="w-full">
      <BillingClient
        slug={slug}
        tenant={{
          name: tenantData.name as string,
          subscription_status: (tenantData.subscription_status as string) ?? "free",
          subscription_tier: (tenantData.subscription_tier as string) ?? "basic",
          subscription_seats: (tenantData.subscription_seats as number) ?? 1,
          trial_started_at: tenantData.trial_started_at as string | null,
          trial_ends_at: tenantData.trial_ends_at as string | null,
        }}
        isOwner={isOwner}
      />
    </main>
  );
}
