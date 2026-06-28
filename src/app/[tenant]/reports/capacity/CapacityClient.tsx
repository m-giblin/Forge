"use client";

import { useState } from "react";
import Link from "next/link";

interface MemberLoad {
  userId: string;
  name: string;
  capacityHours: number;
  committedHours: number;
}

interface SprintCapacity {
  id: string;
  name: string;
  committedHours: number;
  committedPoints: number;
  totalCapacityHours: number;
  memberLoads: MemberLoad[];
}

function loadPct(committed: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.round((committed / capacity) * 100);
}

function loadColor(pct: number): string {
  if (pct > 100) return "#ef4444";
  if (pct >= 80) return "#f59e0b";
  return "#22c55e";
}

function GaugeArc({ pct }: { pct: number }) {
  const r = 70;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;
  const clampedPct = Math.min(pct, 150);
  const filled = (clampedPct / 100) * circumference;
  const color = loadColor(pct);

  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40 mx-auto">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth="14"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1e293b">
        {pct}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#94a3b8">
        capacity
      </text>
    </svg>
  );
}

export default function CapacityClient({
  slug,
  sprints,
}: {
  slug: string;
  sprints: SprintCapacity[];
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (sprints.length === 0) {
    return (
      <main className="w-full px-6 py-10">
        <h1 className="text-xl font-semibold text-neutral-900 mb-4">Capacity vs Committed</h1>
        <p className="text-neutral-500">No active sprints found.</p>
      </main>
    );
  }

  const sprint = sprints[selectedIdx];
  const overallPct = loadPct(sprint.committedHours, sprint.totalCapacityHours);
  const overcommitted = sprint.memberLoads.filter(
    (m) => m.capacityHours > 0 && loadPct(m.committedHours, m.capacityHours) > 100
  );

  return (
    <main className="w-full px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Capacity vs Committed</h1>

      {sprints.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {sprints.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedIdx(i)}
              className={`px-4 py-1.5 rounded-full text-sm border transition ${
                i === selectedIdx
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-neutral-700 border-neutral-300 hover:border-indigo-400"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {overcommitted.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
          ⚠ {overcommitted.length} member{overcommitted.length > 1 ? "s" : ""} are overcommitted this sprint
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="bg-white rounded-xl border border-neutral-200 p-6 flex flex-col items-center gap-2 min-w-52">
          <GaugeArc pct={overallPct} />
          <p className="text-sm text-neutral-600 text-center">
            {sprint.committedHours.toFixed(1)}h of {sprint.totalCapacityHours.toFixed(1)}h committed
          </p>
          <p className="text-xs text-neutral-400">{sprint.committedPoints} story points</p>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Member</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Capacity (h)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Committed (h)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Load %</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {sprint.memberLoads.map((m, i) => {
                const pct = loadPct(m.committedHours, m.capacityHours);
                const color = loadColor(pct);
                const barPct = Math.min(pct, 150) / 150 * 100;
                return (
                  <tr key={m.userId} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                    <td className="px-4 py-3 font-medium text-neutral-800">{m.name}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{m.capacityHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-neutral-600">{m.committedHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color }}>{pct}%</td>
                    <td className="px-4 py-3">
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barPct}%`, backgroundColor: color }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
