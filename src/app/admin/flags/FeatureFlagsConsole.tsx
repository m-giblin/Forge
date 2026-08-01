"use client";

import { useState, useTransition } from "react";
import type { FeatureFlag, TenantOverride } from "@/lib/repositories/featureFlags";
import { setGlobalFlagAction, setTenantOverrideAction, setPlatformSettingAction } from "./actions";
import TogglesList from "@/components/patterns/admin/TogglesList";
import Note from "@/components/patterns/admin/Note";

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

  return (
    <div className="mt-4 space-y-6">
      {error && <Note icon="⚠" tone="error">{error}</Note>}

      {/* Kill switches */}
      <section>
        <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#c0392b]">Platform Kill Switches</p>
        <p className="mb-2.5 text-[11px] text-[#a19d90]">These affect the entire platform immediately. Use with caution.</p>
        <TogglesList
          platform
          items={KILL_SWITCHES.map((ks) => ({
            key: ks.key,
            label: ks.label,
            description: ks.desc,
            on: platformSettings[ks.key] === "true",
            tag: platformSettings[ks.key] === "true" ? (
              <span className="rounded-full bg-[#8a4f13] px-2 py-[2px] text-[10px] font-bold text-white">ACTIVE</span>
            ) : undefined,
          }))}
          onChange={(key) => {
            const active = platformSettings[key] === "true";
            run(() => setPlatformSettingAction(key, active ? "false" : "true"));
          }}
        />
      </section>

      {flags.length === 0 ? (
        <Note icon="⚠" tone="warning">
          No feature flags found — run migration <code className="font-mono">0032_feature_flags.sql</code> to create and seed them.
        </Note>
      ) : (
        <>
          {/* Global defaults */}
          <section>
            <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Global Defaults</p>
            <TogglesList
              platform
              items={flags.map((f) => ({
                key: f.key,
                label: f.label,
                description: FLAG_DESCRIPTIONS[f.key] ?? f.description ?? undefined,
                on: f.enabled,
                tag: <code className="font-mono text-[10px] text-[#a19d90]">{f.key}</code>,
              }))}
              onChange={(key) => {
                const f = flags.find((x) => x.key === key)!;
                run(() => setGlobalFlagAction(key, !f.enabled));
              }}
            />
            <p className="mt-2 text-[11px] text-[#a19d90]">New tenants follow the global default. Existing tenants were seeded with full access via overrides below.</p>
          </section>

          {/* Per-tenant overrides */}
          <section>
            <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Per-Tenant Overrides</p>
            <div className="fw-card overflow-auto">
              <table className="w-full min-w-[600px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#ddd8c9] bg-[#eae6da]">
                    <th className="px-3.5 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Tenant</th>
                    {flags.map((f) => (
                      <th key={f.key} className="px-3.5 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, ti) => (
                    <tr key={t.id} className={ti > 0 ? "border-t border-[#e3ded0]" : ""}>
                      <td className="px-3.5 py-[10px] font-semibold text-[#20201d]">
                        {t.name} <span className="font-mono text-[11px] text-[#a19d90]">/{t.slug}</span>
                      </td>
                      {flags.map((f) => {
                        const has = overrideMap.has(`${t.id}:${f.key}`);
                        const value: "default" | "on" | "off" = !has ? "default" : overrideMap.get(`${t.id}:${f.key}`) ? "on" : "off";
                        const effective = has ? value === "on" : globalMap.get(f.key);
                        return (
                          <td key={f.key} className="px-3.5 py-[10px]">
                            <div className="flex items-center gap-2">
                              <select
                                value={value}
                                disabled={isPending}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  run(() => setTenantOverrideAction(t.id, f.key, v === "default" ? null : v === "on"));
                                }}
                                className="rounded-md border border-[#ddd8c9] bg-white px-2 py-[3px] text-[11.5px] text-[#4a473e] outline-none"
                              >
                                <option value="default">Default ({globalMap.get(f.key) ? "on" : "off"})</option>
                                <option value="on">On</option>
                                <option value="off">Off</option>
                              </select>
                              <span className="text-[12px]" style={{ color: effective ? "#c9791d" : "#cfc9b9" }}>{effective ? "●" : "○"}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-[#a19d90]">{'● = feature is effectively on for that tenant. "Default" follows the global toggle above.'}</p>
          </section>
        </>
      )}
    </div>
  );
}
