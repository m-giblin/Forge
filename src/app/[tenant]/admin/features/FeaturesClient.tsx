"use client";

import { useState, useTransition } from "react";
import { setSelfOverrideAction } from "./actions";
import StatsRow from "@/components/patterns/admin/StatsRow";
import TogglesList, { type ToggleItem } from "@/components/patterns/admin/TogglesList";

type AlwaysOn   = { key: string; label: string; desc: string };
type FeatureRow = { key: string; label: string; description: string | null; includedInPlan: boolean; effectivelyOn: boolean; superOverride: boolean | null; selfDisabled: boolean };
type HigherTier = { key: string; label: string; monthly_cents: number | null; is_active: boolean; features: Record<string, boolean> };
type Notif      = { id: string; title: string; body: string | null; feature_key: string | null; created_at: string };
type Flag       = { key: string; label: string; description: string | null };

function fmtPrice(cents: number | null) {
  if (cents == null) return "Contact sales";
  return `$${(cents / 100).toFixed(0)}/seat/mo`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Tag({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

export default function FeaturesClient({
  slug, plan, currentTier, alwaysOn, myFeatures, higherTiers, allFlags, notifications,
  seats, trialEndsAt, subscriptionStatus,
}: {
  slug: string;
  plan: string;
  currentTier: { key: string; label: string; monthly_cents: number | null } | null;
  alwaysOn: AlwaysOn[];
  myFeatures: FeatureRow[];
  higherTiers: HigherTier[];
  allFlags: Flag[];
  notifications: Notif[];
  seats: number;
  trialEndsAt: string | null;
  subscriptionStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [localState, setLocalState] = useState<Record<string, boolean>>(
    Object.fromEntries(myFeatures.map((f) => [f.key, f.effectivelyOn]))
  );
  const [error, setError] = useState<string | null>(null);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set());
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const activeNotifs = notifications.filter((n) => !dismissedNotifs.has(n.id));

  function toggle(featureKey: string, currentlyOn: boolean) {
    setLocalState((prev) => ({ ...prev, [featureKey]: !currentlyOn }));
    setError(null);
    startTransition(async () => {
      try {
        await setSelfOverrideAction(slug, featureKey, !currentlyOn);
      } catch (e) {
        setLocalState((prev) => ({ ...prev, [featureKey]: currentlyOn })); // rollback
        setError(e instanceof Error ? e.message : "Failed to update.");
      }
    });
  }

  const includedFeatures = myFeatures.filter((f) => f.includedInPlan);
  const activeHigherTiers = higherTiers.filter((t) => t.is_active);
  const addOnCount = activeHigherTiers.reduce((sum, tier) => {
    const newFeatures = allFlags.filter(
      (f) => tier.features[f.key] === true && !myFeatures.find((m) => m.key === f.key && m.includedInPlan)
    );
    return sum + newFeatures.length;
  }, 0);
  const flagMap = new Map(allFlags.map((f) => [f.key, f]));

  const toggleItems: ToggleItem[] = includedFeatures.map((f) => {
    const on = localState[f.key] ?? f.effectivelyOn;
    const superLocked = f.superOverride !== null;
    return {
      key: f.key,
      label: f.label,
      description: f.description ?? undefined,
      on,
      tag: superLocked ? (
        <Tag bg="#f4f2eb" color="#726e60">Locked</Tag>
      ) : (
        <Tag bg="#e4f0e6" color="#3f7a4a">Included</Tag>
      ),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications */}
      {activeNotifs.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeNotifs.map((n) => (
            <div key={n.id} className="fw-card flex items-start gap-3 px-4 py-3">
              <span className="text-lg mt-0.5">✦</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-[#20201d]">{n.title}</p>
                {n.body && <p className="text-[11px] text-[#726e60] mt-0.5">{n.body}</p>}
              </div>
              <button
                onClick={() => setDismissedNotifs((s) => new Set([...s, n.id]))}
                className="text-[#a19d90] hover:text-[#726e60] text-sm shrink-0"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-[5px] border border-[#c0392b]/30 bg-[#c0392b]/10 px-3 py-2 text-[12px] text-[#8c2f22]">{error}</div>
      )}

      {/* Plan overview */}
      <StatsRow
        items={[
          { label: "Plan", value: currentTier?.label ?? plan, hint: fmtPrice(currentTier?.monthly_cents ?? null), color: "#b7452f" },
          { label: "Seats", value: seats, hint: "active seats" },
          {
            label: "Renews",
            value: subscriptionStatus === "trialing" ? fmtDate(trialEndsAt) : "Monthly",
            hint: subscriptionStatus === "trialing" ? "trial ends" : "auto-renews",
            color: "#3f7a4a",
          },
          { label: "Add-ons", value: addOnCount, hint: addOnCount > 0 ? "available to unlock" : "none available" },
        ]}
      />

      {/* Table-stakes features */}
      <div>
        <h2 className="text-[12.5px] font-bold text-[#20201d] mb-3">Always Included</h2>
        <div className="fw-card overflow-hidden">
          {alwaysOn.map((f, i) => (
            <div key={f.key} className={`flex items-center gap-4 px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-[#20201d]">{f.label}</p>
                <p className="text-[11px] text-[#726e60] mt-0.5">{f.desc}</p>
              </div>
              <Tag bg="#e4f0e6" color="#3f7a4a">Included</Tag>
            </div>
          ))}
        </div>
      </div>

      {/* Plan features — toggle to disable */}
      {includedFeatures.length > 0 && (
        <div>
          <h2 className="text-[12.5px] font-bold text-[#20201d] mb-1">Your plan</h2>
          <p className="text-[11px] text-[#726e60] mb-3">Toggle off any feature you don{"'"}t want your team to access.</p>
          <TogglesList
            items={toggleItems}
            onChange={(key, next) => {
              const feature = includedFeatures.find((f) => f.key === key);
              if (!feature || feature.superOverride !== null || isPending) return;
              const on = localState[key] ?? feature.effectivelyOn;
              if (on !== !next) toggle(key, on);
            }}
          />
        </div>
      )}

      {/* Higher tier features — upgrade CTA */}
      {activeHigherTiers.length > 0 && (
        <div>
          <h2 className="text-[12.5px] font-bold text-[#20201d] mb-3">Upgrade to Unlock</h2>
          <div className="flex flex-col gap-3">
            {activeHigherTiers.map((tier) => {
              const newFeatures = allFlags.filter(
                (f) => tier.features[f.key] === true && !myFeatures.find((m) => m.key === f.key && m.includedInPlan)
              );
              if (newFeatures.length === 0) return null;
              const isExpanded = expandedTier === tier.key;
              return (
                <div key={tier.key} className="fw-card overflow-hidden">
                  <div
                    className="flex items-center justify-between gap-4 px-3.5 py-3 cursor-pointer hover:bg-[#f4f2eb] transition"
                    onClick={() => setExpandedTier(isExpanded ? null : tier.key)}
                  >
                    <div>
                      <p className="text-[12.5px] font-bold text-[#20201d]">{tier.label}</p>
                      <p className="text-[11px] text-[#726e60]">{fmtPrice(tier.monthly_cents)} · {newFeatures.length} additional feature{newFeatures.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={`/${slug}/billing`}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-[5px] bg-[#b7452f] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#a03d29] transition"
                      >
                        Upgrade →
                      </a>
                      <span className="text-[#a19d90] text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-[#e3ded0]">
                      {newFeatures.map((f, i) => {
                        const fd = flagMap.get(f.key);
                        return (
                          <div key={f.key} className={`flex items-center gap-3 px-3.5 py-3 ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}>
                            <span className="text-[#a19d90]">○</span>
                            <div className="flex-1">
                              <p className="text-[12.5px] text-[#4a473e] font-medium">{f.label}</p>
                              {fd?.description && <p className="text-[11px] text-[#726e60] mt-0.5">{fd.description}</p>}
                            </div>
                            <Tag bg="#f3e2dd" color="#b7452f">Upgrade</Tag>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
