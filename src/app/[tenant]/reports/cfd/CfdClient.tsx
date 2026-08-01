"use client";

import { useState, useEffect, useCallback } from "react";
import type { CfdResult } from "@/app/api/reports/cfd/route";

interface Project { id: string; name: string }

const FALLBACK_COLORS = ["#b7452f", "#3a6ea8", "#c9791d", "#7a4fa0", "#3f7d4c", "#5b6b4a", "#a1663f"];

export default function CfdClient({
  slug, projects, initialProjectId,
}: {
  slug: string; projects: Project[]; initialProjectId: string;
}) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [result, setResult] = useState<CfdResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((id: string, d: number) => {
    if (!id) return;
    setLoading(true); setError(null);
    fetch(`/api/reports/cfd?projectId=${id}&days=${d}`, { headers: { "x-tenant-slug": slug } })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
        return res.json();
      })
      .then(setResult)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { load(projectId, days); }, [projectId, days, load]);

  // Chart dimensions
  const W = 640, H = 260, PAD = { l: 40, r: 16, t: 16, b: 32 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  function buildBands(res: CfdResult) {
    if (res.points.length < 2) return null;
    const maxTotal = Math.max(1, ...res.points.map((p) => res.statuses.reduce((s, st) => s + (p.counts[st.key] ?? 0), 0)));
    const xStep = chartW / (res.points.length - 1);
    const x = (i: number) => PAD.l + i * xStep;
    const y = (v: number) => PAD.t + chartH - (v / maxTotal) * chartH;

    // Cumulative stack per status, bottom to top, in the server-provided order.
    const cumByPoint = res.points.map((p) => {
      let running = 0;
      return res.statuses.map((s) => {
        running += p.counts[s.key] ?? 0;
        return running;
      });
    });

    const bands = res.statuses.map((s, si) => {
      const topPath = res.points.map((_, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(cumByPoint[i][si])}`).join(" ");
      const bottomPath = res.points
        .map((_, i) => i)
        .reverse()
        .map((i) => `L ${x(i)} ${y(si === 0 ? 0 : cumByPoint[i][si - 1])}`)
        .join(" ");
      return { status: s, areaPath: `${topPath} ${bottomPath} Z`, color: s.color ?? FALLBACK_COLORS[si % FALLBACK_COLORS.length] };
    });

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxTotal * f));
    return { bands, gridLines, x, y, maxTotal };
  }

  const chart = result ? buildBands(result) : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Cumulative Flow</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Issue count per status over time — a widening band means work is piling up there.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${days === d ? "bg-[#8c4632] text-[#f2e9d8]" : "text-[#726e60] hover:text-[#4a473e]"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b7452f]/40"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 text-neutral-400 text-sm">Loading cumulative flow…</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {!loading && !error && projects.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          No active projects yet.
        </div>
      )}

      {result && !loading && chart && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {chart.bands.map((b) => (
              <span key={b.status.key} className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                {b.status.label}
              </span>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {chart.gridLines.map((v) => (
              <g key={v}>
                <line x1={PAD.l} y1={chart.y(v)} x2={W - PAD.r} y2={chart.y(v)} stroke="#f1f5f9" strokeWidth="1" />
                <text x={PAD.l - 4} y={chart.y(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
              </g>
            ))}
            {chart.bands.map((b) => (
              <path key={b.status.key} d={b.areaPath} fill={b.color} opacity="0.85" stroke="white" strokeWidth="0.5" />
            ))}
            {result.points.filter((_, i) => i % Math.max(1, Math.floor(result.points.length / 6)) === 0).map((p, idx) => {
              const origIdx = result.points.indexOf(p);
              return (
                <text key={idx} x={chart.x(origIdx)} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                  {p.date.slice(5)}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      {result && !loading && !chart && (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Not enough data yet to draw a cumulative flow diagram.
        </div>
      )}
    </div>
  );
}
