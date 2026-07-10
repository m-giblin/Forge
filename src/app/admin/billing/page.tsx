import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
import { getStripeConfigStatus } from "@/lib/services/stripeConfig";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { adminStyles as S } from "../page";
import BillingConfigClient from "./BillingConfigClient";

export default async function AdminBillingPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();
  const [status, { data: plans }] = await Promise.all([
    getStripeConfigStatus(),
    svc.from("plan_tiers").select("key, label, monthly_cents, is_active, stripe_price_id").order("display_order"),
  ]);

  return (
    <main style={{ padding: "24px 28px", maxWidth: 900 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Billing — Stripe Setup</h1>
        <p style={S.pageSub}>
          Paste your live Stripe keys here once you have a Stripe account. Nothing changes for customers
          until a secret key is saved — checkout falls back to the existing manual request flow until then.
          Looking for AI cost/usage data? That moved to <Link href="/admin/ai" style={{ color: "#4f46e5", fontWeight: 600 }}>AI Analytics</Link>.
        </p>
      </div>

      <BillingConfigClient
        status={status}
        plans={(plans ?? []) as { key: string; label: string; monthly_cents: number | null; is_active: boolean; stripe_price_id: string | null }[]}
      />
    </main>
  );
}
