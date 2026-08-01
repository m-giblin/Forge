"use client";

import { useMemo, useState } from "react";
import type { UsageRow } from "./page";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import Note from "@/components/patterns/admin/Note";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";

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
  "grok-3-mini": "#c9791d",
  "gpt-4o": "#3f7d4c",
  "claude-sonnet-4-6": "#8a4f13",
  "gemini-2.0-flash": "#3a6ea8",
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
      topFeature: string;
    };
    const map = new Map<string, Stat & { featureCounts: Record<string, number> }>();
    for (const r of filtered) {
      if (!map.has(r.tenantId)) {
        map.set(r.tenantId, { id: r.tenantId, name: r.tenantName, turns: 0, tokensIn: 0, tokensOut: 0, platformCostCents: 0, byoCalls: 0, lastUsed: null, hasByoKey: false, topFeature: "—", featureCounts: {} });
      }
      const s = map.get(r.tenantId)!;
      s.turns++;
      s.tokensIn += r.inputTokens;
      s.tokensOut += r.outputTokens;
      if (r.keySource === "platform") s.platformCostCents += r.costCents;
      else { s.byoCalls++; s.hasByoKey = true; }
      if (!s.lastUsed || r.createdAt > s.lastUsed) s.lastUsed = r.createdAt;
      s.featureCounts[r.feature] = (s.featureCounts[r.feature] ?? 0) + 1;
    }
    return [...map.values()]
      .map((s) => {
        const top = Object.entries(s.featureCounts).sort((a, b) => b[1] - a[1])[0];
        return { ...s, topFeature: top ? (FEATURE_LABELS[top[0]] ?? top[0]) : "—" };
      })
      .sort((a, b) => b.platformCostCents - a.platformCostCents);
  }, [filtered]);

  const chartMax = Math.max(...chartData.map(([, v]) => v.cost), 0.0001);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.key === range)?.label ?? range;

  const tenantColumns = [
    { label: "Tenant", flex: true },
    { label: "Calls", width: 130 },
    { label: "Tokens", width: 140 },
    { label: "Cost", width: 120 },
    { label: "Top feature", width: 220 },
  ];
  const tenantRows: AdminTableCell[][] = tenantStats.map((t) => [
    {
      kind: "text",
      value: (
        <span className="truncate">
          <span className="font-bold text-[#20201d]">{t.name}</span>
          {t.hasByoKey && (
            <span className="ml-1.5 rounded-full bg-[#e9f3ea] px-1.5 py-[1px] text-[10px] font-bold text-[#3f7d4c]">BYO</span>
          )}
        </span>
      ),
    },
    { kind: "text", value: t.turns.toLocaleString() },
    { kind: "text", value: fmtTokens(t.tokensIn + t.tokensOut) },
    { kind: "bold", value: fmtCost(t.platformCostCents) },
    { kind: "dim", value: t.topFeature },
  ]);

  return (
    <div className="space-y-4">
      {aiDisabled && (
        <Note icon="⚠" tone="error">
          <strong>AI is globally disabled</strong> — all AI features are blocked across every tenant. Toggle off in Feature Access → Kill Switches.
        </Note>
      )}

      {notYetMigrated && (
        <Note icon="⏳" tone="warning">
          <strong>Migration 0101_ai_usage_metering.sql hasn&apos;t been run yet</strong> — every number below will be zero until it is. AI features work fine in the meantime; they just aren&apos;t being logged.
        </Note>
      )}

      <FilterRow>
        {RANGE_OPTIONS.map((o) => (
          <FilterPill key={o.key} active={range === o.key} onClick={() => setRange(o.key)}>
            {o.label}
          </FilterPill>
        ))}
      </FilterRow>

      <StatsRow
        items={[
          { label: "Calls (30d)", value: totals.turns.toLocaleString(), hint: rangeLabel },
          { label: "Tokens in", value: fmtTokens(totals.tokensIn), hint: "input tokens" },
          { label: "Tokens out", value: fmtTokens(totals.tokensOut), hint: "output tokens" },
          { label: "Platform cost", value: fmtCost(totals.platformCostCents), hint: "BYO calls cost Forge nothing", color: "#c9791d" },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="fw-card px-3.5 py-3">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">AI Cost — {rangeLabel}</p>
          {chartData.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[#a19d90]">No AI usage in this range.</p>
          ) : (
            <>
              <div className="flex h-20 items-end gap-[2px]">
                {chartData.map(([key, v]) => (
                  <div
                    key={key}
                    title={`${key}: ${fmtCost(v.cost)} · ${v.turns} turn${v.turns !== 1 ? "s" : ""}`}
                    className="flex-1 rounded-t-[2px]"
                    style={{
                      height: `${(v.cost / chartMax) * 100}%`,
                      minHeight: v.cost > 0 ? 3 : 0,
                      backgroundColor: v.cost > 0 ? "#c9791d" : "#eae6da",
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[#cfc9b9]">
                <span>{chartData[0][0]}</span>
                <span>{chartData[chartData.length - 1][0]}</span>
              </div>
            </>
          )}
        </div>

        <div className="fw-card px-3.5 py-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Model breakdown</p>
            <span className="text-[10.5px] text-[#a19d90]">by turns · {rangeLabel}</span>
          </div>
          {modelTotals.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[#a19d90]">No AI turns recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {modelTotals.map(([model, data]) => {
                const pct = totalModelTurns > 0 ? (data.turns / totalModelTurns) * 100 : 0;
                const color = MODEL_COLORS[model] ?? "#a19d90";
                return (
                  <div key={model}>
                    <div className="mb-1 flex justify-between text-[11.5px]">
                      <span className="font-semibold text-[#20201d]">{model}</span>
                      <span className="text-[#726e60]">{data.turns.toLocaleString()} turns · {fmtTokens(data.tokens)} tok · {fmtCost(data.costCents)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#eae6da]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Cost by feature — {rangeLabel}</p>
        <AdminTable
          columns={[{ label: "Feature", flex: true }, { label: "Turns", width: 100 }, { label: "Platform cost", width: 130 }]}
          rows={featureTotals.map(([feature, data]) => [
            { kind: "bold", value: FEATURE_LABELS[feature] ?? feature },
            { kind: "text", value: data.turns.toLocaleString() },
            { kind: "bold", value: fmtCost(data.costCents) },
          ])}
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Platform AI settings</p>
        <div className="fw-card overflow-hidden">
          {[
            {
              label: "AI Kill Switch",
              desc: "Globally disables all AI features across every tenant",
              status: aiDisabled ? "ACTIVE" : "off",
              on: aiDisabled,
            },
            {
              label: "Think Tank (AI Sounding Board)",
              desc: "Feature flag controlling AI-powered idea analysis",
              status: thinkTankEnabled ? "enabled" : "disabled",
              on: thinkTankEnabled,
            },
          ].map((row, i) => (
            <div key={row.label} className={`flex items-center justify-between px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}>
              <div>
                <p className="text-[12.5px] font-semibold text-[#20201d]">{row.label}</p>
                <p className="mt-0.5 text-[11px] text-[#726e60]">{row.desc}</p>
              </div>
              <span
                className="rounded-full px-2.5 py-[3px] text-[11px] font-bold"
                style={row.on ? { color: "#c0392b", backgroundColor: "#fbeae8" } : { color: "#a19d90", backgroundColor: "#f1efe9" }}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[#a19d90]">Change these in <strong>Feature Access</strong> → Kill Switches.</p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Cost by tenant — {rangeLabel}</p>
        <AdminTable columns={tenantColumns} rows={tenantRows} minWidth={700} />
        <p className="mt-1.5 text-[11px] text-[#a19d90]">
          &quot;Platform Cost&quot; is Forge&apos;s own xAI spend — BYO calls are billed to the tenant&apos;s own key and cost Forge nothing.
        </p>
        {byoKeyCount > 0 && (
          <p className="mt-0.5 text-[11px] text-[#a19d90]">{byoKeyCount} tenant BYO key{byoKeyCount === 1 ? "" : "s"} active.</p>
        )}
      </div>
    </div>
  );
}
