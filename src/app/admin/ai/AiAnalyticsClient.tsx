"use client";

import { useMemo, useState } from "react";
import type { UsageRow } from "./page";

const FEATURE_LABELS: Record<string, string> = {
  pr_impact: "PR Impact / Risk Gates",
  sprint_retro: "Sprint Retrospective",
  standup_digest: "Standup Digest",
  board_monitor: "Board Monitor",
  commit_summary: "Commit AI Summary",
  issue_triage: "Issue Triage",
  support_triage: "Support Triage",
  whiteboard_cluster: "Whiteboard Clustering",
  sprint_intelligence: "Sprint Intelligence",
  think_tank_synthesis: "Think Tank: Synthesis",
  think_tank_prd: "Think Tank: Idea→PRD",
  think_tank_competitor_extract: "Think Tank: Competitor Extract",
  think_tank_okr_score: "Think Tank: OKR Scoring",
  sounding_board: "Think Tank: Sounding Board",
  issue_decompose: "Issue Decomposition",
  release_notes: "Release Notes",
  draft_issue: "Quick Capture (Draft Issue)",
  sprint_plan_parser: "Sprint Plan Parser",
};

const MODEL_COLORS: Record<string, string> = {
  "grok-3-mini": "#6366f1",
  "gpt-4o": "#10b981",
  "claude-sonnet-4-6": "#f59e0b",
  "gemini-2.0-flash": "#3b82f6",
};

type RangeKey = "7d" | "30d" | "90d" | "180d" | "ytd" | "life";
const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Weekly" },
  { key: "30d", label: "Monthly" },
  { key: "90d", label: "3 Months" },
  { key: "180d", label: "6 Months" },
  { key: "ytd", label: "YTD" },
  { key: "life", label: "Life" },
];

function cutoffFor(range: RangeKey): number {
  const now = Date.now();
  switch (range) {
    case "7d": return now - 7 * 86_400_000;
    case "30d": return now - 30 * 86_400_000;
    case "90d": return now - 90 * 86_400_000;
    case "180d": return now - 180 * 86_400_000;
    case "ytd": return new Date(new Date().getFullYear(), 0, 1).getTime();
    case "life": return 0;
  }
}

function bucketGranularity(range: RangeKey): "day" | "week" | "month" {
  if (range === "7d" || range === "30d") return "day";
  if (range === "90d" || range === "180d") return "week";
  return "month";
}

function bucketKey(iso: string, granularity: "day" | "week" | "month"): string {
  const d = new Date(iso);
  if (granularity === "day") return iso.slice(0, 10);
  if (granularity === "month") return iso.slice(0, 7);
  // week: Monday-start ISO week, keyed by that Monday's date
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(dollars: number): string {
  if (dollars === 0) return "$0.00";
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function AiAnalyticsClient({
  usageRows,
  notYetMigrated,
  byoKeyCount,
  aiDisabled,
  thinkTankEnabled,
}: {
  usageRows: UsageRow[];
  notYetMigrated: boolean;
  byoKeyCount: number;
  aiDisabled: boolean;
  thinkTankEnabled: boolean;
}) {
  const [range, setRange] = useState<RangeKey>("30d");

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" };
  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 };

  const filtered = useMemo(() => {
    const cutoff = cutoffFor(range);
    return usageRows.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
  }, [usageRows, range]);

  const totals = useMemo(() => {
    let turns = 0, tokensIn = 0, tokensOut = 0, platformCostCents = 0, byoCalls = 0;
    const tenants = new Set<string>();
    for (const r of filtered) {
      turns++;
      tokensIn += r.inputTokens;
      tokensOut += r.outputTokens;
      tenants.add(r.tenantId);
      if (r.keySource === "platform") platformCostCents += r.costCents;
      else byoCalls++;
    }
    return { turns, tokensIn, tokensOut, platformCostCents, tenantsUsingAI: tenants.size, byoCalls };
  }, [filtered]);

  const chartData = useMemo(() => {
    const granularity = bucketGranularity(range);
    const buckets = new Map<string, { cost: number; turns: number }>();
    for (const r of filtered) {
      const key = bucketKey(r.createdAt, granularity);
      const b = buckets.get(key) ?? { cost: 0, turns: 0 };
      if (r.keySource === "platform") b.cost += r.costCents;
      b.turns++;
      buckets.set(key, b);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, range]);

  const modelTotals = useMemo(() => {
    const m: Record<string, { turns: number; tokens: number; costCents: number }> = {};
    for (const r of filtered) {
      if (!m[r.model]) m[r.model] = { turns: 0, tokens: 0, costCents: 0 };
      m[r.model].turns++;
      m[r.model].tokens += r.inputTokens + r.outputTokens;
      if (r.keySource === "platform") m[r.model].costCents += r.costCents;
    }
    return Object.entries(m).sort((a, b) => b[1].turns - a[1].turns);
  }, [filtered]);
  const totalModelTurns = modelTotals.reduce((s, [, v]) => s + v.turns, 0);

  const featureTotals = useMemo(() => {
    const f: Record<string, { turns: number; costCents: number }> = {};
    for (const r of filtered) {
      if (!f[r.feature]) f[r.feature] = { turns: 0, costCents: 0 };
      f[r.feature].turns++;
      if (r.keySource === "platform") f[r.feature].costCents += r.costCents;
    }
    return Object.entries(f).sort((a, b) => b[1].costCents - a[1].costCents);
  }, [filtered]);

  const tenantStats = useMemo(() => {
    type Stat = {
      id: string; name: string; turns: number; tokensIn: number; tokensOut: number;
      platformCostCents: number; byoCalls: number; lastUsed: string | null; hasByoKey: boolean;
    };
    const map = new Map<string, Stat>();
    for (const r of filtered) {
      if (!map.has(r.tenantId)) {
        map.set(r.tenantId, { id: r.tenantId, name: r.tenantName, turns: 0, tokensIn: 0, tokensOut: 0, platformCostCents: 0, byoCalls: 0, lastUsed: null, hasByoKey: false });
      }
      const s = map.get(r.tenantId)!;
      s.turns++;
      s.tokensIn += r.inputTokens;
      s.tokensOut += r.outputTokens;
      if (r.keySource === "platform") s.platformCostCents += r.costCents;
      else { s.byoCalls++; s.hasByoKey = true; }
      if (!s.lastUsed || r.createdAt > s.lastUsed) s.lastUsed = r.createdAt;
    }
    return [...map.values()].sort((a, b) => b.platformCostCents - a.platformCostCents);
  }, [filtered]);

  const chartMax = Math.max(...chartData.map(([, v]) => v.cost), 0.0001);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.key === range)?.label ?? range;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {aiDisabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, fontSize: 12, color: "#991b1b" }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <strong>AI is globally disabled</strong> — all AI features are blocked across every tenant. Toggle off in Feature Flags → Kill Switches.
        </div>
      )}

      {notYetMigrated && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 9, fontSize: 12, color: "#92400e" }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <strong>Migration 0101_ai_usage_metering.sql hasn&apos;t been run yet</strong> — every number below will be zero until it is. AI features work fine in the meantime; they just aren&apos;t being logged.
        </div>
      )}

      {/* Range selector */}
      <div style={{ display: "flex", gap: 6 }}>
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setRange(o.key)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: range === o.key ? "1px solid #4f46e5" : "1px solid #e5e7eb",
              background: range === o.key ? "#eef2ff" : "#fff",
              color: range === o.key ? "#4f46e5" : "#6b7280",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Est. AI Cost (Platform)", value: fmtCost(totals.platformCostCents), sub: rangeLabel, color: "#111827", big: true },
          { label: "Total AI Turns", value: totals.turns.toLocaleString(), sub: rangeLabel, color: "#111827" },
          { label: "Total Tokens Used", value: fmtTokens(totals.tokensIn + totals.tokensOut), sub: "input + output", color: "#111827" },
          { label: "Tenants Using AI", value: totals.tenantsUsingAI, sub: rangeLabel, color: totals.tenantsUsingAI > 0 ? "#4f46e5" : "#94a3b8" },
          { label: "BYO Keys Active", value: byoKeyCount, sub: "tenant-supplied", color: byoKeyCount > 0 ? "#10b981" : "#94a3b8" },
        ].map((k) => (
          <div key={k.label} style={{ background: "#fff", border: k.big ? "1px solid #c7d2fe" : "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{k.label}</div>
            <div style={{ fontSize: k.big ? 30 : 26, fontWeight: 900, color: k.big ? "#4f46e5" : k.color, margin: "4px 0 2px", lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Cost chart + model breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        <div style={card}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>AI Cost — {rangeLabel}</span>
          </div>
          <div style={{ padding: "16px 16px 12px" }}>
            {chartData.length === 0 ? (
              <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", padding: "24px 0" }}>No AI usage in this range.</div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                {chartData.map(([key, v]) => (
                  <div
                    key={key}
                    title={`${key}: ${fmtCost(v.cost)} · ${v.turns} turn${v.turns !== 1 ? "s" : ""}`}
                    style={{
                      flex: 1,
                      height: `${(v.cost / chartMax) * 100}%`,
                      minHeight: v.cost > 0 ? 3 : 0,
                      background: v.cost > 0 ? "#6366f1" : "#f1f5f9",
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                ))}
              </div>
            )}
            {chartData.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#cbd5e1" }}>
                <span>{chartData[0][0]}</span><span>{chartData[chartData.length - 1][0]}</span>
              </div>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Model Breakdown</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>by turns · {rangeLabel}</span>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {modelTotals.length === 0 ? (
              <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", padding: "16px 0" }}>No AI turns recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {modelTotals.map(([model, data]) => {
                  const pct = totalModelTurns > 0 ? (data.turns / totalModelTurns) * 100 : 0;
                  const color = MODEL_COLORS[model] ?? "#94a3b8";
                  return (
                    <div key={model}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{model}</span>
                        <span style={{ color: "#6b7280" }}>{data.turns.toLocaleString()} turns · {fmtTokens(data.tokens)} tok · {fmtCost(data.costCents)}</span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cost by feature */}
      <div>
        <div style={sectionLabel}>Cost by Feature — {rangeLabel}</div>
        <div style={card}>
          {featureTotals.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No AI usage in this range.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Feature", "Turns", "Platform Cost"].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "Platform Cost" ? "right" : "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureTotals.map(([feature, data], i) => (
                  <tr key={feature} style={{ borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 600, color: "#111827" }}>{FEATURE_LABELS[feature] ?? feature}</td>
                    <td style={{ padding: "8px 14px", color: "#6b7280" }}>{data.turns.toLocaleString()}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontFamily: "ui-monospace, monospace", color: "#111827" }}>{fmtCost(data.costCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Feature state */}
      <div>
        <div style={sectionLabel}>Platform AI Settings</div>
        <div style={card}>
          {[
            {
              label: "AI Kill Switch",
              desc: "Globally disables all AI features across every tenant",
              status: aiDisabled ? "ACTIVE" : "off",
              statusBg: aiDisabled ? "#fef2f2" : "#f0fdf4",
              statusColor: aiDisabled ? "#dc2626" : "#16a34a",
            },
            {
              label: "Think Tank (AI Sounding Board)",
              desc: "Feature flag controlling AI-powered idea analysis",
              status: thinkTankEnabled ? "enabled" : "disabled",
              statusBg: thinkTankEnabled ? "#f0fdf4" : "#f8fafc",
              statusColor: thinkTankEnabled ? "#16a34a" : "#94a3b8",
            },
          ].map((row, i) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{row.label}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{row.desc}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 9, fontSize: 11, fontWeight: 700, background: row.statusBg, color: row.statusColor }}>{row.status}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Change these in <strong>Feature Access</strong> → Kill Switches.</p>
      </div>

      {/* Per-tenant usage table */}
      <div>
        <div style={sectionLabel}>Cost by Tenant — {rangeLabel}</div>
        <div style={card}>
          {tenantStats.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
              No AI usage recorded in this range.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Tenant", "Turns", "Tokens In", "Tokens Out", "Platform Cost", "BYO Calls", "Last Used"].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: h === "Platform Cost" ? "right" : "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenantStats.map((t, i) => (
                  <tr key={t.id} style={{ borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 600, color: "#111827" }}>{t.name}</span>
                      {t.hasByoKey && <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 9, fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a" }}>BYO</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#374151", fontWeight: 600 }}>{t.turns.toLocaleString()}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{fmtTokens(t.tokensIn)}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{fmtTokens(t.tokensOut)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#111827", fontFamily: "ui-monospace, monospace" }}>{fmtCost(t.platformCostCents)}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{t.byoCalls || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>{timeAgo(t.lastUsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
          &quot;Platform Cost&quot; is Forge&apos;s own xAI spend — BYO calls are billed to the tenant&apos;s own key and cost Forge nothing.
        </p>
      </div>

    </div>
  );
}
