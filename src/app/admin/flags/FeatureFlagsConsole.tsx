"use client";

import { useState, useTransition } from "react";
import type { FeatureFlag, TenantOverride } from "@/lib/repositories/featureFlags";
import { setGlobalFlagAction, setTenantOverrideAction } from "./actions";

type Tenant = { id: string; name: string; slug: string };

export default function FeatureFlagsConsole({
  flags,
  overrides,
  tenants,
}: {
  flags: FeatureFlag[];
  overrides: TenantOverride[];
  tenants: Tenant[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // (tenantId|"global") -> key -> value
  const overrideMap = new Map<string, boolean>();
  for (const o of overrides) overrideMap.set(`${o.tenantId}:${o.key}`, o.enabled);
  const globalMap = new Map(flags.map((f) => [f.key, f.enabled]));

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed.");
      }
    });
  }

  if (flags.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">
        No feature flags found — run migration <code className="font-mono">0032_feature_flags.sql</code> to create and seed them.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-8">
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      {/* Global defaults */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Global defaults</h2>
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          {flags.map((f, i) => (
            <div key={f.key} className={`flex items-center justify-between gap-4 px-4 py-3 ${i > 0 ? "border-t border-neutral-800" : ""}`}>
              <div>
                <p className="text-sm font-medium text-white">{f.label} <span className="ml-1 font-mono text-xs text-neutral-500">{f.key}</span></p>
                {f.description && <p className="text-xs text-neutral-400">{f.description}</p>}
              </div>
              <button
                onClick={() => run(() => setGlobalFlagAction(f.key, !f.enabled))}
                disabled={isPending}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${f.enabled ? "bg-emerald-500" : "bg-neutral-700"}`}
                aria-label={`Toggle ${f.label}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${f.enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">New tenants follow the global default. Existing tenants were seeded with full access via overrides below.</p>
      </section>

      {/* Per-tenant overrides */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Per-tenant overrides</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 font-medium">Tenant</th>
                {flags.map((f) => (
                  <th key={f.key} className="px-4 py-2 font-medium">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-neutral-800">
                  <td className="px-4 py-2.5 text-white">{t.name} <span className="ml-1 font-mono text-xs text-neutral-500">/{t.slug}</span></td>
                  {flags.map((f) => {
                    const has = overrideMap.has(`${t.id}:${f.key}`);
                    const value: "default" | "on" | "off" = !has ? "default" : overrideMap.get(`${t.id}:${f.key}`) ? "on" : "off";
                    const effective = has ? value === "on" : globalMap.get(f.key);
                    return (
                      <td key={f.key} className="px-4 py-2.5">
                        <select
                          value={value}
                          disabled={isPending}
                          onChange={(e) => {
                            const v = e.target.value;
                            run(() => setTenantOverrideAction(t.id, f.key, v === "default" ? null : v === "on"));
                          }}
                          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-neutral-500"
                        >
                          <option value="default">Default ({globalMap.get(f.key) ? "on" : "off"})</option>
                          <option value="on">On</option>
                          <option value="off">Off</option>
                        </select>
                        <span className={`ml-2 text-[10px] ${effective ? "text-emerald-400" : "text-neutral-600"}`}>{effective ? "●" : "○"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">● = feature is effectively on for that tenant. &ldquo;Default&rdquo; follows the global toggle above.</p>
      </section>
    </div>
  );
}
