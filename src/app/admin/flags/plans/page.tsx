import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PageHeader from "@/components/patterns/PageHeader";
import Note from "@/components/patterns/admin/Note";
import PlansConsole from "./PlansConsole";

export default async function PlansPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();

  const [
    { data: tiers },
    { data: flags },
    { data: tierFeatures },
    { data: tenants },
  ] = await Promise.all([
    svc.from("plan_tiers").select("key, label, description, monthly_cents, is_active, display_order").order("display_order"),
    svc.from("feature_flags").select("key, label, description").order("key"),
    svc.from("plan_tier_features").select("plan_key, feature_key, included"),
    svc.from("tenants").select("id, plan"),
  ]);

  // Count tenants per plan (including overrides count)
  const tenantCountByPlan: Record<string, number> = {};
  const tenantsByPlan: Record<string, string[]> = {};
  for (const t of tenants ?? []) {
    const p = (t.plan as string) ?? "basic";
    tenantCountByPlan[p] = (tenantCountByPlan[p] ?? 0) + 1;
    if (!tenantsByPlan[p]) tenantsByPlan[p] = [];
    tenantsByPlan[p].push(t.id as string);
  }

  // Count per-tenant overrides per plan (so we can show "X with custom overrides")
  const tenantIds = (tenants ?? []).map((t) => t.id as string);
  const { data: overrides } = tenantIds.length > 0
    ? await svc.from("tenant_feature_overrides").select("tenant_id").in("tenant_id", tenantIds)
    : { data: [] };

  const tenantsWithOverrides: Record<string, Set<string>> = {};
  for (const o of overrides ?? []) {
    const tid = o.tenant_id as string;
    const plan = (tenants ?? []).find((t) => t.id === tid)?.plan as string ?? "basic";
    if (!tenantsWithOverrides[plan]) tenantsWithOverrides[plan] = new Set();
    tenantsWithOverrides[plan].add(tid);
  }

  const overrideCountByPlan: Record<string, number> = {};
  for (const [plan, set] of Object.entries(tenantsWithOverrides)) {
    overrideCountByPlan[plan] = set.size;
  }

  // Build feature matrix: plan_key → feature_key → included
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const row of tierFeatures ?? []) {
    const p = row.plan_key as string;
    const f = row.feature_key as string;
    if (!matrix[p]) matrix[p] = {};
    matrix[p][f] = row.included as boolean;
  }

  return (
    <main className="px-6 py-5">
      <PageHeader title="Plans" subtitle="Pricing tiers" />
      <div className="mt-4">
      {(!tiers || tiers.length === 0) ? (
        <Note icon="⚠" tone="warning">
          Plan tiers not found — run migration <code className="font-mono">0086_plan_tiers.sql</code> first.
        </Note>
      ) : (
        <PlansConsole
          tiers={(tiers ?? []) as { key: string; label: string; description: string | null; monthly_cents: number | null; is_active: boolean; display_order: number }[]}
          flags={(flags ?? []) as { key: string; label: string; description: string | null }[]}
          matrix={matrix}
          tenantCountByPlan={tenantCountByPlan}
          overrideCountByPlan={overrideCountByPlan}
        />
      )}
      </div>
    </main>
  );
}
