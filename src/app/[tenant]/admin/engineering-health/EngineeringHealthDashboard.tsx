"use client";

import type { EngHealthData, WeekBucket } from "./page";

function KPI({
  label,
  value,
  sub,
  color = "text-neutral-900",
  alert = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 ${alert ? "border-red-200 bg-red-50" : "border-neutral-200"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function ThroughputBar({ buckets }: { buckets: WeekBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.done));
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">Throughput — Issues done / week</p>
      <div className="flex items-end gap-3 h-24">
        {buckets.map((b, i) => {
          const pct = Math.round((b.done / max) * 100);
          const isLatest = i === buckets.length - 1;
          return (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold text-neutral-600">{b.done}</span>
              <div className="w-full flex items-end" style={{ height: "60px" }}>
                <div
                  className={`w-full rounded-t transition-all ${isLatest ? "bg-indigo-500" : "bg-neutral-200"}`}
                  style={{ height: `${Math.max(4, pct)}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-400">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-neutral-500">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-medium text-neutral-700">{count}</span>
    </div>
  );
}

function CycleSpark({ entries }: { entries: { days: number }[] }) {
  if (entries.length < 2) {
    return <p className="text-xs text-neutral-400 italic">Not enough cycle data yet.</p>;
  }
  const max = Math.max(1, ...entries.map((e) => e.days));
  const w = 300;
  const h = 60;
  const pts = entries
    .slice()
    .reverse()
    .map((e, i) => {
      const x = (i / (entries.length - 1)) * w;
      const y = h - (e.days / max) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }}>
      <polyline
        points={pts}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function EngineeringHealthDashboard({ data }: { data: EngHealthData }) {
  const {
    wip,
    blockedP1,
    avgCycleDays,
    p50CycleDays,
    throughputLast4Weeks,
    openByPriority,
    cycleEntries,
    longestOpenIssueDays,
    percentDoneThisWeek,
    totalOpen,
  } = data;

  const totalByPriority = Object.values(openByPriority).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="WIP"
          value={wip}
          sub="In progress + in review"
          color={wip > 12 ? "text-amber-600" : "text-neutral-900"}
          alert={wip > 20}
        />
        <KPI
          label="Blocked P1s"
          value={blockedP1}
          sub="Urgent, unowned > 24h"
          color={blockedP1 > 0 ? "text-red-600" : "text-green-600"}
          alert={blockedP1 > 0}
        />
        <KPI
          label="Avg cycle time"
          value={avgCycleDays !== null ? `${avgCycleDays}d` : "—"}
          sub={p50CycleDays !== null ? `p50 ${p50CycleDays}d` : "Not enough data"}
        />
        <KPI
          label="Done this week"
          value={`${throughputLast4Weeks[3]?.done ?? 0}`}
          sub={`${percentDoneThisWeek}% of open pipeline`}
          color="text-indigo-600"
        />
      </div>

      {/* Second row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Throughput chart */}
        <div className="lg:col-span-2">
          <ThroughputBar buckets={throughputLast4Weeks} />
        </div>

        {/* Open by priority */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">Open issues by priority</p>
          <div className="space-y-3">
            <PriorityBar label="Urgent" count={openByPriority.urgent} total={totalByPriority} color="bg-red-500" />
            <PriorityBar label="High" count={openByPriority.high} total={totalByPriority} color="bg-orange-400" />
            <PriorityBar label="Medium" count={openByPriority.medium} total={totalByPriority} color="bg-yellow-400" />
            <PriorityBar label="Low" count={openByPriority.low} total={totalByPriority} color="bg-neutral-300" />
          </div>
          <p className="mt-4 text-xs text-neutral-400">{totalOpen} total open</p>
        </div>
      </div>

      {/* Cycle time sparkline */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Cycle time trend (last {cycleEntries.length} completed)</p>
          {longestOpenIssueDays > 0 && (
            <span className="text-xs text-neutral-400">Oldest open issue: <strong className="text-neutral-700">{longestOpenIssueDays}d</strong></span>
          )}
        </div>
        <CycleSpark entries={cycleEntries} />
        {cycleEntries.length === 0 && (
          <p className="text-xs text-neutral-400 italic mt-2">
            Cycle time is calculated from when an issue moves to in_progress until it&apos;s marked done. No completed cycles recorded yet.
          </p>
        )}
      </div>

      {/* Health score summary */}
      <div className={`rounded-xl border-2 p-5 ${blockedP1 > 0 || wip > 20 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{blockedP1 > 0 ? "⚠️" : wip > 20 ? "🟡" : "✅"}</span>
          <div>
            <p className={`text-sm font-semibold ${blockedP1 > 0 || wip > 20 ? "text-amber-800" : "text-green-800"}`}>
              {blockedP1 > 0
                ? `${blockedP1} unowned urgent issue${blockedP1 > 1 ? "s" : ""} need attention`
                : wip > 20
                ? "WIP is high — consider limiting in-progress work"
                : "Board looks healthy"}
            </p>
            <p className={`text-xs mt-0.5 ${blockedP1 > 0 || wip > 20 ? "text-amber-600" : "text-green-600"}`}>
              {avgCycleDays !== null
                ? `Average cycle time ${avgCycleDays}d · ${throughputLast4Weeks[3]?.done ?? 0} issues done this week`
                : "Not enough historical data for cycle time yet."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
