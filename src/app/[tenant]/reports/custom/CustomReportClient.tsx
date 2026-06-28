"use client";

import { useState, useCallback } from "react";

type GroupBy = "status" | "priority" | "type" | "assignee";

interface ReportRow {
  dimension: string;
  count: number;
  open: number;
  closed: number;
}

interface ReportResult {
  groupBy: GroupBy;
  rows: ReportRow[];
  totalIssues: number;
  from: string;
  to: string;
}

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "type", label: "Type" },
  { value: "assignee", label: "Assignee" },
];

const STATUS_COLORS: Record<string, string> = {
  backlog: "#94a3b8", todo: "#64748b", in_progress: "#6366f1",
  in_review: "#8b5cf6", done: "#22c55e",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e", none: "#94a3b8",
};
const TYPE_COLORS: Record<string, string> = {
  bug: "#ef4444", feature: "#6366f1", task: "#94a3b8", question: "#0ea5e9",
};
const FALLBACK_PALETTE = [
  "#6366f1", "#22c55e", "#f97316", "#ef4444", "#8b5cf6",
  "#0ea5e9", "#eab308", "#64748b", "#94a3b8", "#ec4899",
];

function dimensionColor(groupBy: GroupBy, dimension: string, idx: number): string {
  if (groupBy === "status") return STATUS_COLORS[dimension] ?? "#94a3b8";
  if (groupBy === "priority") return PRIORITY_COLORS[dimension] ?? "#94a3b8";
  if (groupBy === "type") return TYPE_COLORS[dimension] ?? "#94a3b8";
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

function dimensionLabel(dimension: string): string {
  return dimension.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function HBar({ label, count, max, color, open, closed }: {
  label: string; count: number; max: number; color: string; open: number; closed: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-right text-xs text-neutral-600">{label}</span>
      <div className="flex-1 h-6 bg-neutral-100 rounded overflow-hidden relative">
        <div className="h-full rounded transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-neutral-700">{count}</span>
      <span className="text-xs text-neutral-400 w-24 shrink-0">
        {open} open · {closed} done
      </span>
    </div>
  );
}

function DonutChart({ rows, groupBy }: { rows: ReportRow[]; groupBy: GroupBy }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (total === 0) return <div className="h-40 flex items-center justify-center text-xs text-neutral-400">No data</div>;

  const r = 60, cx = 80, cy = 80, inner = 36;
  let cumAngle = -Math.PI / 2;
  const slices = rows.map((row, i) => {
    const frac = row.count / total;
    const startAngle = cumAngle;
    cumAngle += frac * 2 * Math.PI;
    const endAngle = cumAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + inner * Math.cos(startAngle);
    const yi1 = cy + inner * Math.sin(startAngle);
    const xi2 = cx + inner * Math.cos(endAngle);
    const yi2 = cy + inner * Math.sin(endAngle);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
    return { d, color: dimensionColor(groupBy, row.dimension, i), label: row.dimension, count: row.count };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0">
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="600" fill="#1e293b">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#94a3b8">issues</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate">{dimensionLabel(s.label)}</span>
            <span className="ml-auto pl-2 font-medium text-neutral-800">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomReportClient({
  slug,
  projectId: initialProjectId,
  projects,
}: {
  slug: string;
  projectId: string;
  projects: { id: string; name: string }[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(today);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ groupBy, from, to });
      if (projectId) params.set("project", projectId);
      const res = await fetch(`/api/reports/custom?${params}`, {
        headers: { "x-tenant-slug": slug },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as ReportResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [slug, groupBy, from, to, projectId]);

  const maxCount = result ? Math.max(1, ...result.rows.map((r) => r.count)) : 1;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-800">Configure Report</h2>
        <div className="flex flex-wrap gap-4">
          {/* Group By */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Group By</label>
            <div className="flex gap-1.5">
              {GROUP_BY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGroupBy(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    groupBy === opt.value
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-xs text-neutral-400">to</span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Running…" : "Run Report"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Summary card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm flex flex-col gap-1">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total Issues</p>
            <p className="text-4xl font-bold text-neutral-900">{result.totalIssues}</p>
            <p className="text-xs text-neutral-400">
              {result.from} → {result.to}
            </p>
            <p className="text-xs text-neutral-400 mt-2">
              {result.rows.length} {result.groupBy} dimension{result.rows.length !== 1 ? "s" : ""}
            </p>
            <div className="mt-3">
              <p className="text-xs font-medium text-neutral-500 mb-2">Distribution</p>
              <DonutChart rows={result.rows} groupBy={result.groupBy} />
            </div>
          </div>

          {/* Bar chart */}
          <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-4">
              Issues by {GROUP_BY_OPTIONS.find((o) => o.value === result.groupBy)?.label}
            </p>
            {result.rows.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-12">No issues in this date range.</p>
            ) : (
              <div className="space-y-3">
                {result.rows.map((row, i) => (
                  <HBar
                    key={row.dimension}
                    label={dimensionLabel(row.dimension)}
                    count={row.count}
                    max={maxCount}
                    color={dimensionColor(result.groupBy, row.dimension, i)}
                    open={row.open}
                    closed={row.closed}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center text-sm text-neutral-400">
          Configure the options above and click <strong>Run Report</strong> to generate a chart.
        </div>
      )}
    </div>
  );
}
