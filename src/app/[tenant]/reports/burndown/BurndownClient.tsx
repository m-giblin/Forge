"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { BurndownResult } from "@/app/api/reports/burndown/route";

interface Sprint { id: string; name: string; status: string; project_id: string; start_date: string; end_date: string }
interface Project { id: string; name: string }

export default function BurndownClient({
  slug, sprints, projects, initialSprintId,
}: {
  slug: string; sprints: Sprint[]; projects: Project[]; initialSprintId: string;
}) {
  const [sprintId, setSprintId] = useState(initialSprintId);
  const [result, setResult] = useState<BurndownResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/reports/burndown?sprintId=${id}`, {
        headers: { "x-tenant-slug": slug },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setResult(await res.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { void load(sprintId); }, [sprintId, load]);

  const sprint = sprints.find((s) => s.id === sprintId);

  // Chart dimensions
  const W = 600, H = 220, PAD = { l: 40, r: 16, t: 16, b: 32 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  function buildChart(points: BurndownResult["points"], total: number) {
    if (points.length < 2) return null;
    const maxY = total;
    const xStep = chartW / (points.length - 1);
    const y = (v: number) => PAD.t + chartH - (v / Math.max(1, maxY)) * chartH;
    const x = (i: number) => PAD.l + i * xStep;

    const idealPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.ideal)}`).join(" ");
    const actualPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.actual)}`).join(" ");
    const areaPath = `${actualPath} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

    return { idealPath, actualPath, areaPath, gridLines, x, y };
  }

  const chart = result ? buildChart(result.points, result.totalPoints) : null;
  const velocityPct = result && result.totalPoints > 0 ? Math.round((result.completedPoints / result.totalPoints) * 100) : 0;
  const onTrack = result && result.points.length > 1 ? result.points[result.points.length - 1].actual <= result.points[result.points.length - 1].ideal : null;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href={`/${slug}/reports`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <span className="text-neutral-400">←</span> Reports
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-800">Burndown</span>
      </div>

      {/* Header + sprint picker */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Sprint Burndown</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Ideal vs actual remaining story points per day</p>
        </div>
        <select
          value={sprintId}
          onChange={(e) => setSprintId(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {projectMap.get(s.project_id) ? `${projectMap.get(s.project_id)} · ` : ""}{s.name}
              {s.status === "active" ? " (Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 text-neutral-400 text-sm">Loading burndown…</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {result && !loading && (
        <>
          {/* KPI row */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Points", value: String(result.totalPoints), color: "#0f172a" },
              { label: "Completed", value: String(result.completedPoints), color: "#22c55e" },
              { label: "Remaining", value: String(result.remainingPoints), color: result.remainingPoints > 0 ? "#f59e0b" : "#22c55e" },
              { label: "Velocity", value: `${velocityPct}%`, color: velocityPct >= 80 ? "#22c55e" : velocityPct >= 50 ? "#f59e0b" : "#ef4444" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{k.label}</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Sprint goal */}
          {result.sprint.goal && (
            <div className="mb-5 rounded-xl border-l-4 border-indigo-500 bg-indigo-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">Sprint Goal</p>
              <p className="text-sm text-indigo-800 italic">{result.sprint.goal}</p>
            </div>
          )}

          {/* Status badge */}
          {onTrack !== null && (
            <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${onTrack ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              <span>{onTrack ? "✓" : "⚠"}</span>
              {onTrack ? "On track — at or below ideal burndown" : "Behind — above ideal burndown line"}
            </div>
          )}

          {/* Chart */}
          {chart && result.points.length > 1 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm mb-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-800">Story Points Remaining</p>
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-neutral-400" />Ideal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-6 bg-indigo-500 rounded" />Actual
                  </span>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                {/* Grid */}
                {chart.gridLines.map((v) => (
                  <g key={v}>
                    <line x1={PAD.l} y1={chart.y(v)} x2={W - PAD.r} y2={chart.y(v)} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={PAD.l - 4} y={chart.y(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
                  </g>
                ))}
                {/* Actual area fill */}
                <path d={chart.areaPath} fill="#6366f1" opacity="0.08" />
                {/* Ideal dashed line */}
                <path d={chart.idealPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 3" />
                {/* Actual line */}
                <path d={chart.actualPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Date labels — every N points */}
                {result.points.filter((_, i) => i % Math.max(1, Math.floor(result.points.length / 6)) === 0).map((p, idx, arr) => {
                  const origIdx = result.points.indexOf(p);
                  return (
                    <text key={idx} x={chart.x(origIdx)} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                      {p.date.slice(5)}
                    </text>
                  );
                })}
                {/* Today marker if sprint active */}
                {sprint?.status === "active" && (() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const todayIdx = result.points.findIndex((p) => p.date === today);
                  if (todayIdx < 0) return null;
                  return <line x1={chart.x(todayIdx)} y1={PAD.t} x2={chart.x(todayIdx)} y2={H - PAD.b} stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />;
                })()}
              </svg>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400 mb-6">
              Not enough data to draw burndown chart. Story points needed on sprint issues.
            </div>
          )}

          {/* Date range */}
          <p className="text-xs text-neutral-400 text-center">
            {result.sprint.startDate} → {result.sprint.endDate}
          </p>
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-16 text-neutral-400">
          {sprints.length === 0 ? (
            <>
              <p className="text-sm font-medium">No sprints found</p>
              <p className="text-xs mt-1">Create and start a sprint to see the burndown chart.</p>
            </>
          ) : (
            <p className="text-sm">Select a sprint to view the burndown chart.</p>
          )}
        </div>
      )}
    </div>
  );
}
