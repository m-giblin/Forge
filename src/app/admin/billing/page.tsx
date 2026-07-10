import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
import { getStripeConfigStatus } from "@/lib/services/stripeConfig";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { adminStyles as S } from "../page";
import BillingConfigClient from "./BillingConfigClient";
import AiUsageSummary from "./AiUsageSummary";

async function loadAiUsage(svc: ReturnType<typeof createSupabaseServiceClient>) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await svc
    .from("ai_usage_events")
    .select("tenant_id, model, key_source, input_tokens, output_tokens, est_cost_hundredth_cents, tenants(name)")
    .gte("created_at", since);

  if (error) return { notYetMigrated: true, rows: [] as never[] };

  const byTenant = new Map<string, { tenantName: string; inputTokens: number; outputTokens: number; estCostCents: number; platformCalls: number; byoCalls: number }>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const tenantId = row.tenant_id as string;
    const tenantName = ((row.tenants as { name: string } | null)?.name) ?? "Unknown";
    const existing = byTenant.get(tenantId) ?? { tenantName, inputTokens: 0, outputTokens: 0, estCostCents: 0, platformCalls: 0, byoCalls: 0 };
    existing.inputTokens += (row.input_tokens as number) ?? 0;
    existing.outputTokens += (row.output_tokens as number) ?? 0;
    if (row.key_source === "platform") {
      existing.estCostCents += ((row.est_cost_hundredth_cents as number) ?? 0) / 100;
      existing.platformCalls += 1;
    } else {
      existing.byoCalls += 1;
    }
    byTenant.set(tenantId, existing);
  }

  const rows = [...byTenant.entries()]
    .map(([tenantId, v]) => ({ tenantId, ...v }))
    .sort((a, b) => b.estCostCents - a.estCostCents);

  return { notYetMigrated: false, rows };
}

export default async function AdminBillingPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();
  const [status, { data: plans }, aiUsage] = await Promise.all([
    getStripeConfigStatus(),
    svc.from("plan_tiers").select("key, label, monthly_cents, is_active, stripe_price_id").order("display_order"),
    loadAiUsage(svc),
  ]);

  return (
    <main style={{ padding: "24px 28px", maxWidth: 900 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Billing — Stripe Setup</h1>
        <p style={S.pageSub}>
          Paste your live Stripe keys here once you have a Stripe account. Nothing changes for customers
          until a secret key is saved — checkout falls back to the existing manual request flow until then.
        </p>
      </div>

      <AiUsageSummary rows={aiUsage.rows} notYetMigrated={aiUsage.notYetMigrated} />

      <BillingConfigClient
        status={status}
        plans={(plans ?? []) as { key: string; label: string; monthly_cents: number | null; is_active: boolean; stripe_price_id: string | null }[]}
      />
    </main>
  );
}
