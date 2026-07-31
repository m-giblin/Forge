import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role required: usage is admin-only cross-user aggregate; all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { membersRepo } from "@/lib/repositories/members";

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

export default async function UsageSeatsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/admin`);

  const svc = createSupabaseServiceClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [members, tenantRow, storageRes, apiCallsRes] = await Promise.all([
    membersRepo(svc).list(ctx.tenant.id),
    svc.from("tenants").select("subscription_tier, subscription_seats").eq("id", ctx.tenant.id).single(),
    svc.from("issue_attachments").select("size_bytes").eq("tenant_id", ctx.tenant.id),
    svc.from("api_call_events").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant.id).gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const seatsUsed = members.length;
  const seatsTotal = (tenantRow.data?.subscription_seats as number | undefined) ?? 1;
  const tier = (tenantRow.data?.subscription_tier as string | undefined) ?? "basic";

  const storageUsedBytes = ((storageRes.data ?? []) as { size_bytes: number }[]).reduce((s, r) => s + r.size_bytes, 0);
  const storageCapBytes = STORAGE_CAP_BYTES[tier] ?? null;

  const apiCalls30d = apiCallsRes.count ?? 0;

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Usage &amp; seats</h2>
      <p className="mt-1 text-sm text-neutral-500">What this workspace is actually using against what it&apos;s provisioned for.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Seats</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {seatsUsed} <span className="text-base font-normal text-neutral-400">/ {seatsTotal}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className={`h-full rounded-full ${seatsUsed > seatsTotal ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, (seatsUsed / Math.max(1, seatsTotal)) * 100)}%` }} />
          </div>
          {seatsUsed > seatsTotal && <p className="mt-2 text-xs font-medium text-red-600">Over your purchased seat count — add seats in Billing.</p>}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">API calls</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{apiCalls30d.toLocaleString()}</p>
          <p className="mt-2 text-xs text-neutral-400">Last 30 days, across all API keys</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Storage</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {fmtBytes(storageUsedBytes)} {storageCapBytes != null && <span className="text-base font-normal text-neutral-400">/ {fmtBytes(storageCapBytes)}</span>}
          </p>
          {storageCapBytes != null ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className={`h-full rounded-full ${storageUsedBytes > storageCapBytes ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, (storageUsedBytes / storageCapBytes) * 100)}%` }} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-neutral-400">Unlimited on your plan</p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Storage counts issue attachments currently stored (not a rolling upload allowance — see Fields &amp; Labels for the separate monthly upload quota). API call volume started being tracked when this page shipped; earlier calls aren&apos;t counted.
      </p>
    </section>
  );
}
