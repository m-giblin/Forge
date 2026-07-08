"use client";

import { useState, useTransition } from "react";
import { setPlanTierFeatureAction, setPlanActiveAction, applyPlanToTenantsAction } from "./actions";

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

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && (
        <div style={{ padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>{error}</div>
      )}
      {applyResult && (
        <div style={{ padding: "9px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 12, color: "#166534" }}>
          <strong>{applyResult.feature}</strong> applied to <strong>{applyResult.applied}</strong> tenant{applyResult.applied !== 1 ? "s" : ""}.
          {applyResult.skipped > 0 && ` ${applyResult.skipped} skipped (have custom super-admin overrides).`}
        </div>
      )}

      {/* Plan tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {tiers.map((t) => {
          const active = t.key === activePlan;
          const isOn = localActive[t.key];
          return (
            <button
              key={t.key}
              onClick={() => { setActivePlan(t.key); setApplyResult(null); }}
              style={{
                padding: "8px 18px", borderRadius: 8, border: "1px solid",
                borderColor: active ? "#4f46e5" : "#e5e7eb",
                background: active ? "#4f46e5" : "#fff",
                color: active ? "#fff" : "#374151",
                fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              {t.label}
              {!isOn && (
                <span style={{ fontSize: 9, fontWeight: 700, background: "#fde68a", color: "#92400e", padding: "1px 5px", borderRadius: 5 }}>INACTIVE</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Plan header card */}
      <div style={card}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{tier.label}</span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtPrice(tier.monthly_cents)}</span>
            </div>
            {tier.description && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{tier.description}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Tenants on this plan</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{tenantCount}</div>
              {overrideCount > 0 && <div style={{ fontSize: 10, color: "#94a3b8" }}>{overrideCount} with custom overrides</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Plan Active</div>
              <button
                onClick={() => togglePlanActive(tier.key, !localActive[tier.key])}
                disabled={isPending}
                style={{
                  position: "relative", width: 44, height: 24, borderRadius: 12, border: "none",
                  cursor: "pointer", flexShrink: 0,
                  background: localActive[tier.key] ? "#10b981" : "#d1d5db",
                  opacity: isPending ? .5 : 1, transition: "background .15s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%",
                  background: "#fff", transition: "left .15s",
                  left: localActive[tier.key] ? 22 : 2,
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* Always-on features (table stakes) */}
        <div style={{ padding: "10px 18px 4px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Always Included (Table Stakes)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 10 }}>
            {ALWAYS_ON.map((k) => (
              <span key={k} style={{ padding: "3px 10px", borderRadius: 9, fontSize: 11, fontWeight: 600, background: "#d1fae5", color: "#059669" }}>
                ✓ {ALWAYS_ON_LABELS[k]}
              </span>
            ))}
          </div>
        </div>

        {/* Feature rows */}
        <div>
          <div style={{ display: "flex", padding: "8px 18px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Feature</span>
            <span style={{ width: 80, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Included</span>
            <span style={{ width: 200, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Apply to Tenants</span>
          </div>
          {flags.map((f, i) => {
            const included = localMatrix[activePlan]?.[f.key] ?? false;
            return (
              <div key={f.key} style={{ display: "flex", alignItems: "center", padding: "10px 18px", borderTop: i > 0 ? "1px solid #f8fafc" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{f.label}</div>
                  {f.description && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{f.description}</div>}
                </div>
                <div style={{ width: 80, display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={() => toggleFeature(f.key, !included)}
                    disabled={isPending}
                    style={{
                      position: "relative", width: 44, height: 24, borderRadius: 12, border: "none",
                      cursor: "pointer", background: included ? "#10b981" : "#d1d5db",
                      opacity: isPending ? .5 : 1, transition: "background .15s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%",
                      background: "#fff", transition: "left .15s", left: included ? 22 : 2,
                    }} />
                  </button>
                </div>
                <div style={{ width: 200, display: "flex", justifyContent: "center" }}>
                  {tenantCount > 0 ? (
                    <button
                      onClick={() => applyToTenants(f.key, f.label, included)}
                      disabled={isPending}
                      style={{
                        padding: "4px 12px", borderRadius: 6, border: "1px solid #e5e7eb",
                        background: "#fff", fontSize: 11, fontWeight: 600,
                        color: included ? "#059669" : "#dc2626", cursor: "pointer",
                        opacity: isPending ? .4 : 1,
                      }}
                    >
                      {included ? "▲ Push On" : "▼ Push Off"} to {tenantCount}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>No tenants</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#94a3b8" }}>
        Toggling a feature here updates the <strong>plan default</strong> — new tenants on this plan get it automatically.
        Use <strong>&quot;Push On/Off to N&quot;</strong> to immediately update existing tenants (skips any with super-admin overrides).
      </p>
    </div>
  );
}
