"use client";

import { useState, useEffect, useCallback } from "react";
import type { CycleTimeResult, CycleTimeItem } from "@/app/api/reports/cycle-time/route";

interface Project { id: string; name: string }

export default function ControlChartClient({
  slug, projects, initialProjectId, initialFrom, initialTo,
}: {
  slug: string; projects: Project[]; initialProjectId: string; initialFrom: string; initialTo: string;
}) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [result, setResult] = useState<CycleTimeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<CycleTimeItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (projectId) params.set("project", projectId);
      // Reuses the Cycle Time endpoint — same underlying calculation, this
      // page is just a different visualization of it (a chronological
      // scatter instead of grouped averages).
      const res = await fetch(`/api/reports/cycle-time?${params}`, { headers: { "x-tenant-slug": slug } });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setResult(await res.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [slug, from, to, projectId]);

  useEffect(() => { void load(); }, [load]);

  const W = 720, H = 280, PAD = { l: 44, r: 84, t: 16, b: 32 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const items = result?.allItems ?? [];
  const hasChart = items.length > 1 && result;

  let chart: {
    x: (iso: string) => number;
    y: (v: number) => number;
    gridLines: number[];
    dateTicks: { x: number; label: string }[];
  } | null = null;

  if (hasChart && result) {
    const times = items.map((i) => new Date(i.resolvedAt).getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const tSpan = Math.max(1, tMax - tMin);
    const maxY = Math.max(result.p90, ...items.map((i) => i.cycleDays)) * 1.15 || 1;

    const x = (iso: string) => PAD.l + ((new Date(iso).getTime() - tMin) / tSpan) * chartW;
    const y = (v: number) => PAD.t + chartH - (v / maxY) * chartH;
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

    const tickCount = 6;
    const dateTicks = Array.from({ length: tickCount }, (_, i) => {
      const t = tMin + (tSpan * i) / (tickCount - 1);
      return { x: PAD.l + (chartW * i) / (tickCount - 1), label: new Date(t).toISOString().slice(5, 10) };
    });

    chart = { x, y, gridLines, dateTicks };
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Control Chart</h1>
          <p className="text-sm text-neutral-500">Every completed issue&apos;s cycle time, plotted against the day it finished — spot special-cause variation, not just the average.</p>
        </div>
      </div>

      <div className="mb-6 mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">Calculating…</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && result && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            {[
              { label: "Issues plotted", value: String(items.length), color: "#0f172a" },
              { label: "Median (P50)", value: `${result.median}d`, color: "#0f172a" },
              { label: "P90", value: `${result.p90}d`, color: "#f59e0b" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{k.label}</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {hasChart && chart ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-800">Cycle Time by Completion Date</p>
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />Normal
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />Above P90
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-6 bg-neutral-700 rounded" />Median
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-amber-500" />P90
                  </span>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                {chart.gridLines.map((v) => (
                  <g key={v}>
                    <line x1={PAD.l} y1={chart!.y(v)} x2={W - PAD.r} y2={chart!.y(v)} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={PAD.l - 4} y={chart!.y(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}d</text>
                  </g>
                ))}

                {chart.dateTicks.map((t, i) => (
                  <text key={i} x={t.x} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">{t.label}</text>
                ))}

                {/* Median reference line */}
                <line x1={PAD.l} y1={chart.y(result.median)} x2={W - PAD.r} y2={chart.y(result.median)} stroke="#0f172a" strokeWidth="1.5" opacity="0.6" />
                <text x={W - PAD.r + 6} y={chart.y(result.median) + 3} fontSize="9" fill="#0f172a">Median {result.median}d</text>

                {/* P90 reference line */}
                <line x1={PAD.l} y1={chart.y(result.p90)} x2={W - PAD.r} y2={chart.y(result.p90)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.8" />
                <text x={W - PAD.r + 6} y={chart.y(result.p90) + 3} fontSize="9" fill="#f59e0b">P90 {result.p90}d</text>

                {/* Scatter points */}
                {items.map((item) => {
                  const isOutlier = item.cycleDays > result.p90;
                  return (
                    <circle
                      key={item.issueId}
                      cx={chart!.x(item.resolvedAt)}
                      cy={chart!.y(item.cycleDays)}
                      r={hovered?.issueId === item.issueId ? 5 : 3}
                      fill={isOutlier ? "#ef4444" : "#6366f1"}
                      opacity={hovered && hovered.issueId !== item.issueId ? 0.35 : 0.75}
                      onMouseEnter={() => setHovered(item)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <title>{`${item.title} — ${item.cycleDays}d (resolved ${item.resolvedAt.slice(0, 10)})`}</title>
                    </circle>
                  );
                })}
              </svg>
              {hovered && (
                <p className="mt-2 text-xs text-neutral-600">
                  <span className="font-semibold">{hovered.cycleDays}d</span> — {hovered.title} · resolved {hovered.resolvedAt.slice(0, 10)}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
              Not enough completed issues in this range to draw a control chart.
            </div>
          )}
        </>
      )}
    </div>
  );
}
