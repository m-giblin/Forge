"use client";

import { useState, useTransition } from "react";
import type { FeatureFlag, TenantOverride } from "@/lib/repositories/featureFlags";
import { setGlobalFlagAction, setTenantOverrideAction, setPlatformSettingAction } from "./actions";

type Tenant = { id: string; name: string; slug: string };

const FLAG_DESCRIPTIONS: Record<string, string> = {
  think_tank:     "Enables the Think Tank idea capture and voting system",
  dashboards:     "Enables Mission Control and delivery intelligence dashboards",
  project_portal: "Enables Project Overview, Timeline and Cost tracking",
  roadmap:        "Enables the visual Roadmap planning board",
};

const KILL_SWITCHES: Array<{ key: string; label: string; desc: string }> = [
  { key: "maintenance_mode", label: "Maintenance Mode",    desc: "Blocks all tenant access with a maintenance banner" },
  { key: "ai_disabled",      label: "Disable AI Globally", desc: "Kills all AI features across every workspace" },
];

function Toggle({ on, disabled, onToggle, danger }: { on: boolean; disabled: boolean; onToggle: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label="toggle"
      style={{
        position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
        background: on ? (danger ? "#ef4444" : "#10b981") : "#d1d5db",
        opacity: disabled ? .5 : 1, transition: "background .15s",
      }}
    >
      <span style={{
        position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%",
        background: "#fff", transition: "left .15s",
        left: on ? 22 : 2,
      }} />
    </button>
  );
}

export default function FeatureFlagsConsole({
  flags,
  overrides,
  tenants,
  platformSettings,
}: {
  flags: FeatureFlag[];
  overrides: TenantOverride[];
  tenants: Tenant[];
  platformSettings: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const overrideMap = new Map<string, boolean>();
  for (const o of overrides) overrideMap.set(`${o.tenantId}:${o.key}`, o.enabled);
  const globalMap = new Map(flags.map((f) => [f.key, f.enabled]));

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    });
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" };
  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 };

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 28 }}>
      {error && <div style={{ padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>{error}</div>}

      {/* Kill switches */}
      <section>
        <div style={{ ...sectionLabel, color: "#ef4444" }}>Platform Kill Switches</div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>These affect the entire platform immediately. Use with caution.</p>
        <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, overflow: "hidden" }}>
          {KILL_SWITCHES.map((ks, i) => {
            const active = platformSettings[ks.key] === "true";
            return (
              <div key={ks.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 16px", borderTop: i > 0 ? "1px solid #fee2e2" : "none" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>{ks.label}</span>
                    {active && <span style={{ padding: "1px 7px", borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700 }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 2 }}>{ks.desc}</div>
                </div>
                <Toggle on={active} disabled={isPending} danger onToggle={() => run(() => setPlatformSettingAction(ks.key, active ? "false" : "true"))} />
              </div>
            );
          })}
        </div>
      </section>

      {flags.length === 0 ? (
        <div style={{ padding: "16px 18px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 13, color: "#92400e" }}>
          No feature flags found — run migration <code style={{ fontFamily: "monospace" }}>0032_feature_flags.sql</code> to create and seed them.
        </div>
      ) : (
        <>
          {/* Global defaults */}
          <section>
            <div style={sectionLabel}>Global Defaults</div>
            <div style={card}>
              {flags.map((f, i) => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 16px", borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{f.label}</span>
                      <code style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{f.key}</code>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{FLAG_DESCRIPTIONS[f.key] ?? f.description ?? ""}</div>
                  </div>
                  <Toggle on={f.enabled} disabled={isPending} onToggle={() => run(() => setGlobalFlagAction(f.key, !f.enabled))} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>New tenants follow the global default. Existing tenants were seeded with full access via overrides below.</p>
          </section>

          {/* Per-tenant overrides */}
          <section>
            <div style={sectionLabel}>Per-Tenant Overrides</div>
            <div style={{ ...card, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Tenant</th>
                    {flags.map((f) => (
                      <th key={f.key} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, ti) => (
                    <tr key={t.id} style={{ borderTop: ti > 0 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "#111827" }}>
                        {t.name} <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>/{t.slug}</span>
                      </td>
                      {flags.map((f) => {
                        const has = overrideMap.has(`${t.id}:${f.key}`);
                        const value: "default" | "on" | "off" = !has ? "default" : overrideMap.get(`${t.id}:${f.key}`) ? "on" : "off";
                        const effective = has ? value === "on" : globalMap.get(f.key);
                        return (
                          <td key={f.key} style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <select
                                value={value}
                                disabled={isPending}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  run(() => setTenantOverrideAction(t.id, f.key, v === "default" ? null : v === "on"));
                                }}
                                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, color: "#374151", outline: "none" }}
                              >
                                <option value="default">Default ({globalMap.get(f.key) ? "on" : "off"})</option>
                                <option value="on">On</option>
                                <option value="off">Off</option>
                              </select>
                              <span style={{ fontSize: 12, color: effective ? "#10b981" : "#d1d5db" }}>{effective ? "●" : "○"}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{'● = feature is effectively on for that tenant. "Default" follows the global toggle above.'}</p>
          </section>
        </>
      )}
    </div>
  );
}
