import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role needed for plan/flag reads (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import FeaturesClient from "./FeaturesClient";

const ALWAYS_ON = [
  { key: "kanban",   label: "Kanban Board + Issues",       desc: "Full kanban board, list view, and issue management" },
  { key: "sprints",  label: "Sprint Planning",              desc: "Sprint creation, backlog grooming, and velocity tracking" },
  { key: "burndown", label: "Burndown / Velocity Charts",   desc: "Burndown, velocity, and completion rate charts" },
];

export default async function TenantFeaturesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/admin`);

  const svc = createSupabaseServiceClient();

  const plan = (ctx.tenant as unknown as { plan?: string }).plan ?? "basic";

  const [
    { data: allTiers },
    { data: flags },
    { data: planFeatures },
    { data: superOverrides },
    { data: selfOverrides },
    { data: notifications },
  ] = await Promise.all([
    svc.from("plan_tiers").select("key, label, monthly_cents, is_active, display_order").order("display_order"),
    svc.from("feature_flags").select("key, label, description"),
    svc.from("plan_tier_features").select("feature_key, included").eq("plan_key", plan),
    svc.from("tenant_feature_overrides").select("key, enabled").eq("tenant_id", ctx.tenant.id),
    svc.from("tenant_self_overrides").select("feature_key, enabled").eq("tenant_id", ctx.tenant.id),
    svc.from("tenant_notifications")
      .select("id, title, body, feature_key, created_at")
      .eq("tenant_id", ctx.tenant.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // For each higher tier, fetch their feature set so we can show upgrade info
  const higherTiers = (allTiers ?? []).filter((t) => {
    const order: Record<string, number> = { basic: 1, premium: 2, pro: 3, enterprise: 4 };
    return (order[t.key as string] ?? 99) > (order[plan] ?? 0);
  });

  const higherTierFeatures: Record<string, Record<string, boolean>> = {};
  if (higherTiers.length > 0) {
    const { data: htf } = await svc
      .from("plan_tier_features")
      .select("plan_key, feature_key, included")
      .in("plan_key", higherTiers.map((t) => t.key as string));
    for (const row of htf ?? []) {
      const p = row.plan_key as string;
      if (!higherTierFeatures[p]) higherTierFeatures[p] = {};
      higherTierFeatures[p][row.feature_key as string] = row.included as boolean;
    }
  }

  const planMap = new Map((planFeatures ?? []).map((r) => [r.feature_key as string, r.included as boolean]));
  const superMap = new Map((superOverrides ?? []).map((r) => [r.key as string, r.enabled as boolean]));
  const selfMap  = new Map((selfOverrides ?? []).map((r) => [r.feature_key as string, r.enabled as boolean]));

  type FeatureRow = {
    key: string; label: string; description: string | null;
    includedInPlan: boolean;
    effectivelyOn: boolean;
    superOverride: boolean | null;
    selfDisabled: boolean;
  };

  const myFeatures: FeatureRow[] = (flags ?? []).map((f) => {
    const key = f.key as string;
    const inPlan = superMap.has(key) ? superMap.get(key)! : (planMap.get(key) ?? false);
    const selfOff = selfMap.get(key) === false;
    return {
      key,
      label: f.label as string,
      description: f.description as string | null,
      includedInPlan: inPlan,
      effectivelyOn: inPlan && !selfOff,
      superOverride: superMap.has(key) ? superMap.get(key)! : null,
      selfDisabled: selfOff,
    };
  });

  const currentTier = (allTiers ?? []).find((t) => t.key === plan);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Features & Plan</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage which features are active in your workspace. You can disable features your team doesn{"'"}t use — but you can{"'"}t enable features outside your plan.
        </p>
      </div>

      <FeaturesClient
        slug={slug}
        plan={plan}
        currentTier={currentTier ? { key: currentTier.key as string, label: currentTier.label as string, monthly_cents: currentTier.monthly_cents as number | null } : null}
        alwaysOn={ALWAYS_ON}
        myFeatures={myFeatures}
        higherTiers={higherTiers.map((t) => ({
          key: t.key as string,
          label: t.label as string,
          monthly_cents: t.monthly_cents as number | null,
          is_active: t.is_active as boolean,
          features: higherTierFeatures[t.key as string] ?? {},
        }))}
        allFlags={(flags ?? []).map((f) => ({ key: f.key as string, label: f.label as string, description: f.description as string | null }))}
        notifications={(notifications ?? []).map((n) => ({
          id: n.id as string,
          title: n.title as string,
          body: n.body as string | null,
          feature_key: n.feature_key as string | null,
          created_at: n.created_at as string,
        }))}
      />
    </div>
  );
}
