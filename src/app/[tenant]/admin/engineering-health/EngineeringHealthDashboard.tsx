"use client";

import type { EngHealthData } from "./page";
import StatsRow from "@/components/patterns/admin/StatsRow";
import Bars from "@/components/patterns/admin/Bars";

function CycleSpark({ entries }: { entries: { days: number }[] }) {
  if (entries.length < 2) {
    return <p className="text-[11.5px] italic text-[#a19d90]">Not enough cycle data yet.</p>;
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
      <polyline points={pts} fill="none" stroke="#b7452f" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
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

  const healthy = blockedP1 === 0 && wip <= 20;

  return (
    <div className="space-y-5">
      <StatsRow
        items={[
          { label: "WIP", value: wip, hint: "In progress + in review", color: wip > 20 ? "#c0392b" : wip > 12 ? "#c9791d" : undefined },
          { label: "Blocked P1s", value: blockedP1, hint: "Urgent, unowned > 24h", color: blockedP1 > 0 ? "#c0392b" : "#3f7d4c" },
          { label: "Avg cycle time", value: avgCycleDays !== null ? `${avgCycleDays}d` : "—", hint: p50CycleDays !== null ? `p50 ${p50CycleDays}d` : "Not enough data" },
          { label: "Done this week", value: throughputLast4Weeks[3]?.done ?? 0, hint: `${percentDoneThisWeek}% of open pipeline`, color: "#b7452f" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Bars
            color="#3f7d4c"
            items={throughputLast4Weeks.map((b) => ({ label: b.label, value: b.done }))}
          />
        </div>

        <div className="fw-card px-4 py-4">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Open issues by priority</p>
          <Bars
            color="#8c4632"
            items={[
              { label: "Urgent", value: openByPriority.urgent },
              { label: "High", value: openByPriority.high },
              { label: "Medium", value: openByPriority.medium },
              { label: "Low", value: openByPriority.low },
            ]}
          />
          <p className="mt-3 text-[11px] text-[#a19d90]">{totalOpen} total open</p>
        </div>
      </div>

      <div className="fw-card px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Cycle time trend (last {cycleEntries.length} completed)</p>
          {longestOpenIssueDays > 0 && (
            <span className="text-[11px] text-[#a19d90]">Oldest open issue: <strong className="text-[#20201d]">{longestOpenIssueDays}d</strong></span>
          )}
        </div>
        <CycleSpark entries={cycleEntries} />
        {cycleEntries.length === 0 && (
          <p className="mt-2 text-[11.5px] italic text-[#a19d90]">
            Cycle time is calculated from when an issue moves to in_progress until it&apos;s marked done. No completed cycles recorded yet.
          </p>
        )}
      </div>

      <div
        className="rounded-[6px] border-2 px-5 py-4"
        style={healthy ? { borderColor: "#c9d9c9", backgroundColor: "#e9f3ea" } : { borderColor: "#f0dcb8", backgroundColor: "#fdf1de" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[22px]">{blockedP1 > 0 ? "⚠️" : wip > 20 ? "🟡" : "✅"}</span>
          <div>
            <p className="text-[12.5px] font-bold" style={{ color: healthy ? "#3f7d4c" : "#c9791d" }}>
              {blockedP1 > 0
                ? `${blockedP1} unowned urgent issue${blockedP1 > 1 ? "s" : ""} need attention`
                : wip > 20
                ? "WIP is high — consider limiting in-progress work"
                : "Board looks healthy"}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: healthy ? "#3f7d4c" : "#c9791d" }}>
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
