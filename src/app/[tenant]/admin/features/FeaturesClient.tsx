"use client";

import { useState, useTransition } from "react";
import { setSelfOverrideAction } from "./actions";

type AlwaysOn   = { key: string; label: string; desc: string };
type FeatureRow = { key: string; label: string; description: string | null; includedInPlan: boolean; effectivelyOn: boolean; superOverride: boolean | null; selfDisabled: boolean };
type HigherTier = { key: string; label: string; monthly_cents: number | null; is_active: boolean; features: Record<string, boolean> };
type Notif      = { id: string; title: string; body: string | null; feature_key: string | null; created_at: string };
type Flag       = { key: string; label: string; description: string | null };

function fmtPrice(cents: number | null) {
  if (cents == null) return "Contact sales";
  return `$${(cents / 100).toFixed(0)}/seat/mo`;
}

export default function FeaturesClient({
  slug, plan, currentTier, alwaysOn, myFeatures, higherTiers, allFlags, notifications,
}: {
  slug: string;
  plan: string;
  currentTier: { key: string; label: string; monthly_cents: number | null } | null;
  alwaysOn: AlwaysOn[];
  myFeatures: FeatureRow[];
  higherTiers: HigherTier[];
  allFlags: Flag[];
  notifications: Notif[];
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
  const flagMap = new Map(allFlags.map((f) => [f.key, f]));

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications */}
      {activeNotifs.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeNotifs.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <span className="text-lg mt-0.5">✦</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-900">{n.title}</p>
                {n.body && <p className="text-xs text-indigo-700 mt-0.5">{n.body}</p>}
              </div>
              <button
                onClick={() => setDismissedNotifs((s) => new Set([...s, n.id]))}
                className="text-indigo-400 hover:text-indigo-600 text-sm shrink-0"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Current plan banner */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">Current Plan</div>
            <div className="text-xl font-black text-indigo-700">{currentTier?.label ?? plan}</div>
            <div className="text-sm text-indigo-500 mt-0.5">{fmtPrice(currentTier?.monthly_cents ?? null)}</div>
          </div>
          <a
            href={`/${slug}/billing`}
            className="shrink-0 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition"
          >
            Manage billing →
          </a>
        </div>
      </div>

      {/* Table-stakes features */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Always Included</h2>
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {alwaysOn.map((f, i) => (
            <div key={f.key} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-neutral-100" : ""}`}>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-800">{f.label}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{f.desc}</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">Always on</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan features — toggle to disable */}
      {includedFeatures.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">Your Plan Features</h2>
          <p className="text-xs text-neutral-400 mb-3">Toggle off any feature you don{"'"}t want your team to access.</p>
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            {includedFeatures.map((f, i) => {
              const on = localState[f.key] ?? f.effectivelyOn;
              const superLocked = f.superOverride !== null;
              return (
                <div key={f.key} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-neutral-100" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${on ? "text-neutral-800" : "text-neutral-400"}`}>{f.label}</p>
                    {f.description && <p className="text-xs text-neutral-400 mt-0.5 truncate">{f.description}</p>}
                    {superLocked && (
                      <p className="text-xs text-amber-600 mt-0.5">Set by platform admin — contact support to change.</p>
                    )}
                  </div>
                  {superLocked ? (
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${on ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400"}`}>
                      {on ? "On" : "Off"} (locked)
                    </span>
                  ) : (
                    <button
                      onClick={() => toggle(f.key, on)}
                      disabled={isPending}
                      style={{
                        position: "relative", width: 44, height: 24, borderRadius: 12, border: "none",
                        cursor: isPending ? "wait" : "pointer", flexShrink: 0,
                        background: on ? "#10b981" : "#d1d5db",
                        opacity: isPending ? .5 : 1, transition: "background .15s",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%",
                        background: "#fff", transition: "left .15s", left: on ? 22 : 2,
                      }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Higher tier features — upgrade CTA */}
      {higherTiers.filter((t) => t.is_active).length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Upgrade to Unlock</h2>
          <div className="flex flex-col gap-3">
            {higherTiers.filter((t) => t.is_active).map((tier) => {
              const newFeatures = allFlags.filter(
                (f) => tier.features[f.key] === true && !myFeatures.find((m) => m.key === f.key && m.includedInPlan)
              );
              if (newFeatures.length === 0) return null;
              const isExpanded = expandedTier === tier.key;
              return (
                <div key={tier.key} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                  <div
                    className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-neutral-50 transition"
                    onClick={() => setExpandedTier(isExpanded ? null : tier.key)}
                  >
                    <div>
                      <p className="text-sm font-bold text-neutral-800">{tier.label}</p>
                      <p className="text-xs text-neutral-400">{fmtPrice(tier.monthly_cents)} · {newFeatures.length} additional feature{newFeatures.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={`/${slug}/billing`}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                      >
                        Upgrade →
                      </a>
                      <span className="text-neutral-300 text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-neutral-100">
                      {newFeatures.map((f, i) => {
                        const fd = flagMap.get(f.key);
                        return (
                          <div key={f.key} className={`flex items-center gap-3 px-5 py-3 ${i > 0 ? "border-t border-neutral-50" : ""}`}>
                            <span className="text-neutral-300">○</span>
                            <div className="flex-1">
                              <p className="text-sm text-neutral-500 font-medium">{f.label}</p>
                              {fd?.description && <p className="text-xs text-neutral-400 mt-0.5">{fd.description}</p>}
                            </div>
                            <span className="text-xs text-neutral-300 bg-neutral-100 rounded-full px-2 py-0.5">Upgrade to unlock</span>
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
