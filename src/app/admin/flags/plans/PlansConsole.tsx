"use client";

import { useState, useTransition } from "react";
import { setPlanTierFeatureAction, setPlanActiveAction, applyPlanToTenantsAction } from "./actions";
import Toggle from "@/components/patterns/Toggle";
import Note from "@/components/patterns/admin/Note";

type Tier = { key: string; label: string; description: string | null; monthly_cents: number | null; is_active: boolean; display_order: number };
type Flag = { key: string; label: string; description: string | null };

const ALWAYS_ON = ["kanban", "sprints", "burndown"] as const;
const ALWAYS_ON_LABELS: Record<string, string> = {
  kanban:   "Kanban Board + Issues",
  sprints:  "Sprint Planning",
  burndown: "Burndown / Velocity Charts",
};

function fmtPrice(cents: number | null) {
  if (cents == null) return "Contact sales";
  return `$${(cents / 100).toFixed(0)}/seat/mo`;
}

export default function PlansConsole({
  tiers, flags, matrix, tenantCountByPlan, overrideCountByPlan,
}: {
  tiers: Tier[];
  flags: Flag[];
  matrix: Record<string, Record<string, boolean>>;
  tenantCountByPlan: Record<string, number>;
  overrideCountByPlan: Record<string, number>;
}) {
  const [isPending, startTransition] = useTransition();
  const [activePlan, setActivePlan] = useState(tiers[0]?.key ?? "basic");
  const [localMatrix, setLocalMatrix] = useState<Record<string, Record<string, boolean>>>(matrix);
  const [localActive, setLocalActive] = useState<Record<string, boolean>>(
    Object.fromEntries(tiers.map((t) => [t.key, t.is_active]))
  );
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ feature: string; applied: number; skipped: number } | null>(null);

  const tier = tiers.find((t) => t.key === activePlan)!;
  const tenantCount = tenantCountByPlan[activePlan] ?? 0;
  const overrideCount = overrideCountByPlan[activePlan] ?? 0;

  function run(fn: () => Promise<void>) {
    setError(null);
    setApplyResult(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    });
  }

  function toggleFeature(featureKey: string, included: boolean) {
    setLocalMatrix((prev) => ({
      ...prev,
      [activePlan]: { ...(prev[activePlan] ?? {}), [featureKey]: included },
    }));
    run(() => setPlanTierFeatureAction(activePlan, featureKey, included));
  }

  function togglePlanActive(planKey: string, isActive: boolean) {
    setLocalActive((prev) => ({ ...prev, [planKey]: isActive }));
    run(() => setPlanActiveAction(planKey, isActive));
  }

  function applyToTenants(featureKey: string, featureLabel: string, included: boolean) {
    run(async () => {
      const result = await applyPlanToTenantsAction(activePlan, featureKey, included);
      setApplyResult({ feature: featureLabel, ...result });
    });
  }

  return (
    <div className="space-y-5">
      {error && <Note icon="⚠" tone="error">{error}</Note>}
      {applyResult && (
        <Note icon="✓" tone="info">
          <strong>{applyResult.feature}</strong> applied to <strong>{applyResult.applied}</strong> tenant{applyResult.applied !== 1 ? "s" : ""}.
          {applyResult.skipped > 0 && ` ${applyResult.skipped} skipped (have custom super-admin overrides).`}
        </Note>
      )}

      {/* Plan cards — select which plan to edit below */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {tiers.map((t) => {
          const active = t.key === activePlan;
          const isOn = localActive[t.key];
          const count = tenantCountByPlan[t.key] ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setActivePlan(t.key); setApplyResult(null); }}
              className="fw-card px-3.5 py-3 text-left transition-colors"
              style={active ? { borderColor: "#c9791d", boxShadow: "0 0 0 1px #c9791d" } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">{t.label}</span>
                {!isOn && (
                  <span className="rounded-[5px] bg-[#f4ead4] px-[6px] py-[1px] text-[9px] font-bold text-[#8a4f13]">INACTIVE</span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-[#726e60]">{fmtPrice(t.monthly_cents)}</p>
              {t.description && <p className="mt-1 text-[11px] text-[#a19d90]">{t.description}</p>}
              <p className="mt-2 text-[11.5px] font-semibold text-[#c9791d]">{count} tenant{count === 1 ? "" : "s"} →</p>
            </button>
          );
        })}
      </div>

      {/* Plan editor */}
      <div className="fw-card overflow-hidden">
        <div className="flex items-center gap-4 border-b border-[#e3ded0] px-4 py-3.5">
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <span className="text-[16px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">{tier.label}</span>
              <span className="text-[12px] text-[#726e60]">{fmtPrice(tier.monthly_cents)}</span>
            </div>
            {tier.description && <p className="mt-0.5 text-[11px] text-[#a19d90]">{tier.description}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] text-[#a19d90]">Tenants on this plan</p>
              <p className="text-[18px] font-extrabold text-[#20201d]">{tenantCount}</p>
              {overrideCount > 0 && <p className="text-[10px] text-[#a19d90]">{overrideCount} with custom overrides</p>}
            </div>
            <div>
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Plan active</p>
              <Toggle platform on={localActive[tier.key]} onChange={(next) => togglePlanActive(tier.key, next)} label="Plan active" />
            </div>
          </div>
        </div>

        {/* Always-on features (table stakes) */}
        <div className="border-b border-[#e3ded0] bg-[#f4f2eb] px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Always included (table stakes)</p>
          <div className="flex flex-wrap gap-2">
            {ALWAYS_ON.map((k) => (
              <span key={k} className="rounded-full bg-[#e9f3ea] px-2.5 py-[3px] text-[11px] font-semibold text-[#3f7d4c]">
                ✓ {ALWAYS_ON_LABELS[k]}
              </span>
            ))}
          </div>
        </div>

        {/* Feature rows */}
        <div>
          <div className="flex items-center gap-3 border-b border-[#e3ded0] bg-[#f4f2eb] px-4 py-2">
            <span className="flex-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Feature</span>
            <span className="w-20 text-center text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Included</span>
            <span className="w-[200px] text-center text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Apply to tenants</span>
          </div>
          {flags.map((f, i) => {
            const included = localMatrix[activePlan]?.[f.key] ?? false;
            return (
              <div key={f.key} className={`flex items-center gap-3 px-4 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}>
                <div className="flex-1">
                  <p className="text-[12.5px] font-semibold text-[#20201d]">{f.label}</p>
                  {f.description && <p className="mt-0.5 text-[11px] text-[#726e60]">{f.description}</p>}
                </div>
                <div className="flex w-20 justify-center">
                  <Toggle platform on={included} onChange={(next) => toggleFeature(f.key, next)} label={f.label} />
                </div>
                <div className="flex w-[200px] justify-center">
                  {tenantCount > 0 ? (
                    <button
                      onClick={() => applyToTenants(f.key, f.label, included)}
                      disabled={isPending}
                      className="rounded-md border border-[#ddd8c9] bg-white px-3 py-1 text-[11px] font-semibold disabled:opacity-40"
                      style={{ color: included ? "#3f7d4c" : "#c0392b" }}
                    >
                      {included ? "▲ Push On" : "▼ Push Off"} to {tenantCount}
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#cfc9b9]">No tenants</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-[#a19d90]">
        Toggling a feature here updates the <strong>plan default</strong> — new tenants on this plan get it automatically.
        Use <strong>&quot;Push On/Off to N&quot;</strong> to immediately update existing tenants (skips any with super-admin overrides).
      </p>
    </div>
  );
}
