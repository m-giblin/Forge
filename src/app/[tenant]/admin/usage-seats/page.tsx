import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: usage is admin-only cross-user aggregate; all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import Bars from "@/components/patterns/admin/Bars";

// Storage caps by purchased tier — mirrors the marketing copy in
// src/app/[tenant]/billing/BillingClient.tsx's TIERS list ("5 GB storage" /
// "Unlimited storage"). Not read from there directly (that file is UI copy,
// not a shared constant) — if the marketing copy ever changes, update both.
const STORAGE_CAP_BYTES: Record<string, number | null> = {
  basic: 5 * 1024 * 1024 * 1024,
  premium: null,
  pro: null,
  enterprise: null,
};

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtCents(hundredthCents: number): string {
  const dollars = hundredthCents / 100_000;
  return `$${dollars.toFixed(dollars < 1 ? 3 : 2)}`;
}

export default async function UsageSeatsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/admin`);

  const svc = createSupabaseServiceClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [members, tenantRow, storageRes, apiCallsRes, aiUsageRes] = await Promise.all([
    membersRepo(svc).list(ctx.tenant.id),
    svc.from("tenants").select("subscription_tier, subscription_seats").eq("id", ctx.tenant.id).single(),
    svc.from("issue_attachments").select("size_bytes").eq("tenant_id", ctx.tenant.id),
    svc.from("api_call_events").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant.id).gte("created_at", thirtyDaysAgo.toISOString()),
    svc.from("ai_usage_events").select("feature, est_cost_hundredth_cents").eq("tenant_id", ctx.tenant.id).gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const seatsUsed = members.length;
  const seatsTotal = (tenantRow.data?.subscription_seats as number | undefined) ?? 1;
  const tier = (tenantRow.data?.subscription_tier as string | undefined) ?? "basic";

  const storageUsedBytes = ((storageRes.data ?? []) as { size_bytes: number }[]).reduce((s, r) => s + r.size_bytes, 0);
  const storageCapBytes = STORAGE_CAP_BYTES[tier] ?? null;

  const apiCalls30d = apiCallsRes.count ?? 0;

  const aiEvents = (aiUsageRes.data ?? []) as { feature: string; est_cost_hundredth_cents: number }[];
  const aiSpendHundredthCents = aiEvents.reduce((s, r) => s + r.est_cost_hundredth_cents, 0);
  const aiByFeature = Object.entries(
    aiEvents.reduce<Record<string, number>>((acc, r) => {
      acc[r.feature] = (acc[r.feature] ?? 0) + r.est_cost_hundredth_cents;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([feature, cents]) => ({ label: feature, value: cents, hint: fmtCents(cents) }));

  const seatsOver = seatsUsed > seatsTotal;
  const storageOver = storageCapBytes != null && storageUsedBytes > storageCapBytes;

  return (
    <div className="space-y-6">
      <PageHeader title="Usage & Seats" subtitle="Consumption against your plan limits" />

      <div className="space-y-6 px-6">
        <StatsRow
          items={[
            {
              label: "Seats",
              value: `${seatsUsed} / ${seatsTotal}`,
              hint: seatsOver ? "over your purchased count" : "provisioned",
              color: seatsOver ? "#b7452f" : undefined,
            },
            { label: "API Calls", value: apiCalls30d.toLocaleString(), hint: "last 30 days" },
            {
              label: "Storage",
              value: storageCapBytes != null ? `${fmtBytes(storageUsedBytes)} / ${fmtBytes(storageCapBytes)}` : fmtBytes(storageUsedBytes),
              hint: storageCapBytes != null ? (storageOver ? "over your plan limit" : "of plan limit") : "unlimited on your plan",
              color: storageOver ? "#b7452f" : undefined,
            },
            { label: "AI Spend", value: fmtCents(aiSpendHundredthCents), hint: "last 30 days, platform keys" },
          ]}
        />

        {aiByFeature.length > 0 && (
          <div>
            <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">AI spend by feature (30d)</h2>
            <Bars items={aiByFeature} color="#3a6ea8" />
          </div>
        )}

        <p className="text-[11px] text-[#a19d90]">
          Storage counts issue attachments currently stored (not a rolling upload allowance — see Fields &amp; Labels for the separate monthly upload quota). API call volume started being tracked when this page shipped; earlier calls aren&apos;t counted.
        </p>
      </div>
    </div>
  );
}
