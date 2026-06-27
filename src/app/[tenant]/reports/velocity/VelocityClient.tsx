"use client";

import { useState } from "react";
import Link from "next/link";

interface SprintData {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  plannedPoints: number;
  completedPoints: number;
  loggedMinutes: number;
  totalIssues: number;
  doneIssues: number;
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function VelocityClient({
  slug,
  sprints,
}: {
  slug: string;
  sprints: SprintData[];
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const projects = Array.from(
    new Map(sprints.map((s) => [s.projectId, s.projectName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const filtered = selectedProjectId
    ? sprints.filter((s) => s.projectId === selectedProjectId)
    : sprints;

  const breadcrumb = (
    <Link href={`/${slug}/reports`} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 group">
      <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Reports
    </Link>
  );

  if (sprints.length === 0) {
    return (
      <main className="w-full px-6 py-10">
        {breadcrumb}
        <h1 className="text-xl font-semibold text-neutral-900 mb-4">Sprint Velocity</h1>
        <p className="text-neutral-500">No completed sprints found.</p>
      </main>
    );
  }

  const avgVelocity =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, sp) => s + sp.completedPoints, 0) / filtered.length
        )
      : 0;

  const chartW = 600;
  const chartH = 220;
  const padL = 36;
  const padB = 50;
  const padT = 16;
  const padR = 16;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const maxPts = Math.max(1, ...filtered.map((s) => Math.max(s.plannedPoints, s.completedPoints)));
  const barGroupW = filtered.length > 0 ? innerW / filtered.length : innerW;
  const barW = Math.min(28, barGroupW * 0.35);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxPts));

  function barX(i: number, offset: number) {
    return padL + i * barGroupW + barGroupW / 2 - barW + offset;
  }
  function barH(pts: number) {
    return (pts / maxPts) * innerH;
  }
  function barY(pts: number) {
    return padT + innerH - barH(pts);
  }

  return (
    <main className="w-full px-6 py-8 space-y-6">
      {breadcrumb}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Sprint Velocity</h1>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
          Avg velocity: {avgVelocity} pts/sprint
        </span>
      </div>

      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedProjectId(null)}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              selectedProjectId === null
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-neutral-700 border-neutral-300 hover:border-indigo-400"
            }`}
          >
            All projects
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                selectedProjectId === p.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-neutral-700 border-neutral-300 hover:border-indigo-400"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
          {gridLines.map((v) => {
            const y = padT + innerH - (v / maxPts) * innerH;
            return (
              <g key={v}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
              </g>
            );
          })}
          {filtered.map((s, i) => {
            const ph = barH(s.plannedPoints);
            const ch = barH(s.completedPoints);
            return (
              <g key={s.id}>
                <rect
                  x={barX(i, 0)}
                  y={barY(s.plannedPoints)}
                  width={barW}
                  height={ph}
                  fill="#e5e7eb"
                  rx="2"
                />
                <rect
                  x={barX(i, barW + 2)}
                  y={barY(s.completedPoints)}
                  width={barW}
                  height={ch}
                  fill="#6366f1"
                  rx="2"
                />
                <text
                  x={padL + i * barGroupW + barGroupW / 2}
                  y={padT + innerH + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748b"
                  transform={`rotate(-35, ${padL + i * barGroupW + barGroupW / 2}, ${padT + innerH + 14})`}
                >
                  {s.name.length > 14 ? s.name.slice(0, 13) + "…" : s.name}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex gap-4 justify-center text-xs text-neutral-500 mt-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#e5e7eb]" />
            Planned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#6366f1]" />
            Completed
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Sprint</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Project</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Planned</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Completed</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Velocity %</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Time logged</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500">Done/Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const velPct = s.plannedPoints > 0
                ? Math.round((s.completedPoints / s.plannedPoints) * 100)
                : null;
              const velColor =
                velPct === null
                  ? "text-neutral-400"
                  : velPct >= 80
                  ? "text-green-700 bg-green-50"
                  : velPct >= 60
                  ? "text-amber-700 bg-amber-50"
                  : "text-red-700 bg-red-50";
              return (
                <tr key={s.id} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                  <td className="px-4 py-3 font-medium text-neutral-800">{s.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{s.projectName}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">{s.plannedPoints}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">{s.completedPoints}</td>
                  <td className="px-4 py-3 text-right">
                    {velPct !== null ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${velColor}`}>
                        {velPct}%
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600">{fmtMinutes(s.loggedMinutes)}</td>
                  <td className="px-4 py-3 text-right text-neutral-600">{s.doneIssues}/{s.totalIssues}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
