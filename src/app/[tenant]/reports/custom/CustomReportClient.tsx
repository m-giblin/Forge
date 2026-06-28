"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { GroupBy, Metric, DateGroup, CustomReportResult, ReportRow, TrendPoint, ReportSummary } from "@/app/api/reports/custom/route";

// ── Constants ─────────────────────────────────────────────────────────────────
const GROUP_BY_OPTIONS: { value: GroupBy; label: string; icon: string }[] = [
  { value: "status", label: "Status", icon: "◉" },
  { value: "priority", label: "Priority", icon: "▲" },
  { value: "type", label: "Type", icon: "⬡" },
  { value: "assignee", label: "Assignee", icon: "👤" },
  { value: "label", label: "Label", icon: "🏷" },
  { value: "sprint", label: "Sprint", icon: "🏃" },
  { value: "project", label: "Project", icon: "📋" },
  { value: "phase", label: "Phase", icon: "📍" },
  { value: "environment", label: "Env", icon: "🌐" },
];
const METRIC_OPTIONS: { value: Metric; label: string; unit: string }[] = [
  { value: "count", label: "Issue Count", unit: "" },
  { value: "story_points", label: "Story Points", unit: "pts" },
  { value: "time_logged", label: "Time Logged", unit: "h" },
];
const CHART_TYPES = ["bar-h", "bar-v", "donut", "line", "table"] as const;
type ChartType = (typeof CHART_TYPES)[number];
const CHART_TYPE_LABELS: Record<ChartType, string> = { "bar-h": "Bar", "bar-v": "Column", donut: "Donut", line: "Trend", table: "Table" };
const CHART_TYPE_ICONS: Record<ChartType, string> = { "bar-h": "≡", "bar-v": "▐", donut: "◑", line: "∿", table: "⊞" };

// ── Color maps ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  backlog: "#94a3b8", todo: "#64748b", in_progress: "#6366f1",
  in_review: "#8b5cf6", done: "#22c55e", closed: "#22c55e", unknown: "#cbd5e1",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e", none: "#94a3b8",
};
const TYPE_COLORS: Record<string, string> = {
  bug: "#ef4444", feature: "#6366f1", task: "#94a3b8", question: "#0ea5e9",
};
const PALETTE = ["#6366f1","#22c55e","#f97316","#ef4444","#8b5cf6","#0ea5e9","#eab308","#64748b","#ec4899","#14b8a6","#f59e0b","#84cc16"];
function dimColor(groupBy: GroupBy, dim: string, i: number): string {
  if (groupBy === "status") return STATUS_COLORS[dim] ?? "#94a3b8";
  if (groupBy === "priority") return PRIORITY_COLORS[dim] ?? "#94a3b8";
  if (groupBy === "type") return TYPE_COLORS[dim] ?? "#94a3b8";
  return PALETTE[i % PALETTE.length];
}
function dimLabel(dim: string): string {
  return dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Saved Reports ─────────────────────────────────────────────────────────────
interface SavedReport {
  id: string;
  name: string;
  config: { groupBy: GroupBy; metric: Metric; from: string; to: string; projectId: string; trend: boolean; dateGroup: DateGroup; compare: boolean };
}

function useSavedReports(slug: string) {
  const key = `forge_custom_reports_${slug}`;
  const [saved, setSaved] = useState<SavedReport[]>([]);
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { /* */ }
  }, [key]);
  const save = useCallback((name: string, config: SavedReport["config"]) => {
    const next: SavedReport[] = [{ id: crypto.randomUUID(), name, config }, ...saved.filter((s) => s.name !== name)].slice(0, 12);
    setSaved(next);
    localStorage.setItem(key, JSON.stringify(next));
  }, [saved, key]);
  const remove = useCallback((id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    localStorage.setItem(key, JSON.stringify(next));
  }, [saved, key]);
  return { saved, save, remove };
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, children }: { label: string; value: string; sub?: string; accent?: string; children?: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none" style={{ color: accent ?? "#0f172a" }}>{value || "—"}</p>
      {sub && <p className="mt-1 text-[11px] text-neutral-400">{sub}</p>}
      {children}
    </div>
  );
}

function Delta({ curr, prev }: { curr: number; prev?: number }) {
  if (prev == null || prev === 0) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`ml-2 text-[10px] font-semibold ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// ── Horizontal Bar Chart ───────────────────────────────────────────────────────
function HBarChart({ rows, groupBy, metric, unit }: { rows: ReportRow[]; groupBy: GroupBy; metric: Metric; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.slice(0, 20).map((row, i) => (
        <div key={row.dimension} className="flex items-center gap-3 group">
          <span className="w-32 shrink-0 truncate text-right text-xs text-neutral-600 group-hover:text-neutral-900 transition-colors" title={dimLabel(row.dimension)}>
            {dimLabel(row.dimension)}
          </span>
          <div className="relative flex-1 h-7 bg-neutral-100 rounded-lg overflow-hidden">
            <div
              className="h-full rounded-lg transition-all duration-500"
              style={{ width: `${(row.value / max) * 100}%`, backgroundColor: dimColor(groupBy, row.dimension, i) }}
            />
            <span className="absolute inset-0 flex items-center pl-2 text-[11px] font-semibold text-white mix-blend-difference pointer-events-none">
              {metric === "time_logged" ? `${row.value.toFixed(1)}${unit}` : `${Math.round(row.value)}${unit}`}
            </span>
          </div>
          <div className="flex gap-3 shrink-0 text-[11px] text-neutral-400 w-32">
            <span className="text-indigo-500">{row.open} open</span>
            <span className="text-green-500">{Math.round(row.closed)} done</span>
            <span className="font-medium text-neutral-600">{row.pctDone}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Vertical Bar Chart ────────────────────────────────────────────────────────
function VBarChart({ rows, groupBy, metric, unit }: { rows: ReportRow[]; groupBy: GroupBy; metric: Metric; unit: string }) {
  const data = rows.slice(0, 12);
  const max = Math.max(1, ...data.map((r) => r.value));
  const W = 600, H = 200, PAD = 32, barW = Math.min(40, (W - PAD * 2) / data.length - 8);
  const colW = (W - PAD * 2) / data.length;
  const yScale = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: yScale(f * max), label: metric === "time_logged" ? `${(f * max).toFixed(1)}h` : String(Math.round(f * max)) }));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full min-w-[400px]">
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={PAD} y1={g.y} x2={W - PAD} y2={g.y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD - 6} y={g.y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{g.label}</text>
          </g>
        ))}
        {data.map((row, i) => {
          const x = PAD + i * colW + (colW - barW) / 2;
          const barH = ((row.value / max) * (H - PAD * 2));
          const y = H - PAD - barH;
          const color = dimColor(groupBy, row.dimension, i);
          return (
            <g key={row.dimension}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx="3" opacity="0.9" />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fill={color} fontWeight="600">
                {metric === "time_logged" ? row.value.toFixed(1) : Math.round(row.value)}{unit}
              </text>
              <text
                x={PAD + i * colW + colW / 2}
                y={H + 14}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
                transform={`rotate(-35, ${PAD + i * colW + colW / 2}, ${H + 14})`}
              >
                {dimLabel(row.dimension).slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Line / Trend Chart ────────────────────────────────────────────────────────
function LineChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return <p className="py-12 text-center text-sm text-neutral-400">No trend data in this range.</p>;
  const W = 600, H = 180, PAD = { l: 40, r: 20, t: 20, b: 36 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.value, p.prevValue ?? 0)));
  const xStep = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const y = (v: number) => PAD.t + innerH - (v / maxVal) * innerH;
  const x = (i: number) => PAD.l + i * xStep;
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1)} ${PAD.t + innerH} L ${PAD.l} ${PAD.t + innerH} Z`;
  const prevPath = points.filter((p) => p.prevValue != null).map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.prevValue!)}`).join(" ");
  const gridYs = [0, 0.5, 1].map((f) => y(f * maxVal));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[400px]">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {gridYs.map((gy, i) => (
          <line key={i} x1={PAD.l} y1={gy} x2={W - PAD.r} y2={gy} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <path d={areaPath} fill="url(#areaGrad)" />
        {prevPath && <path d={prevPath} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />}
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.key}>
            <circle cx={x(i)} cy={y(p.value)} r="3.5" fill="#6366f1" />
            {p.prevValue != null && <circle cx={x(i)} cy={y(p.prevValue)} r="2.5" fill="#cbd5e1" />}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="#94a3b8" transform={points.length > 8 ? `rotate(-45, ${x(i)}, ${H - 8})` : undefined}>
              {p.label}
            </text>
            <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" fontSize="8" fill="#4f46e5" fontWeight="600">
              {p.value}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex gap-4 text-[11px] text-neutral-500">
        <span><span className="inline-block w-6 h-0.5 bg-indigo-500 align-middle mr-1.5" />Current period</span>
        {points.some((p) => p.prevValue != null) && <span><span className="inline-block w-6 h-0.5 bg-neutral-300 align-middle mr-1.5 border-dashed border-t" />Previous period</span>}
      </div>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ rows, groupBy }: { rows: ReportRow[]; groupBy: GroupBy }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total === 0) return <p className="py-12 text-center text-sm text-neutral-400">No data.</p>;
  const [hovered, setHovered] = useState<string | null>(null);
  const R = 70, CX = 90, CY = 90, INNER = 42;
  let cumAngle = -Math.PI / 2;
  const slices = rows.slice(0, 12).map((row, i) => {
    const frac = row.value / total;
    const startAngle = cumAngle;
    cumAngle += frac * 2 * Math.PI;
    const endAngle = cumAngle;
    const large = frac > 0.5 ? 1 : 0;
    const ox = hovered === row.dimension ? 4 : 0;
    const midAngle = (startAngle + endAngle) / 2;
    const dx = Math.cos(midAngle) * ox;
    const dy = Math.sin(midAngle) * ox;
    const path = (r: number, ir: number) => {
      const x1 = CX + r * Math.cos(startAngle) + dx;
      const y1 = CY + r * Math.sin(startAngle) + dy;
      const x2 = CX + r * Math.cos(endAngle) + dx;
      const y2 = CY + r * Math.sin(endAngle) + dy;
      const xi1 = CX + ir * Math.cos(startAngle) + dx;
      const yi1 = CY + ir * Math.sin(startAngle) + dy;
      const xi2 = CX + ir * Math.cos(endAngle) + dx;
      const yi2 = CY + ir * Math.sin(endAngle) + dy;
      return `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z`;
    };
    return { d: path(R, INNER), color: dimColor(groupBy, row.dimension, i), row };
  });

  const hoveredRow = rows.find((r) => r.dimension === hovered);
  return (
    <div className="flex items-start gap-8">
      <div className="relative shrink-0">
        <svg viewBox="0 0 180 180" className="w-44 h-44">
          {slices.map((s) => (
            <path
              key={s.row.dimension}
              d={s.d}
              fill={s.color}
              opacity={hovered && hovered !== s.row.dimension ? 0.4 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHovered(s.row.dimension)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <text x={CX} y={CY - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">
            {hoveredRow ? Math.round(hoveredRow.value) : Math.round(total)}
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {hoveredRow ? dimLabel(hoveredRow.dimension).slice(0, 14) : "total"}
          </text>
        </svg>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5 max-h-44 overflow-y-auto pr-1">
        {slices.map((s) => (
          <div
            key={s.row.dimension}
            className={`flex items-center gap-2.5 text-xs rounded-lg px-2 py-1.5 cursor-default transition-colors ${hovered === s.row.dimension ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
            onMouseEnter={() => setHovered(s.row.dimension)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="flex-1 truncate text-neutral-700">{dimLabel(s.row.dimension)}</span>
            <span className="font-semibold text-neutral-800">{Math.round(s.row.value)}</span>
            <span className="text-neutral-400 w-8 text-right">{s.row.pctDone}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Data Table ────────────────────────────────────────────────────────────────
function DataTable({ rows, groupBy, metric, unit }: { rows: ReportRow[]; groupBy: GroupBy; metric: Metric; unit: string }) {
  const [sortKey, setSortKey] = useState<keyof ReportRow>("value");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const sorted = [...rows].sort((a, b) => sortDir * (a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0));
  const toggle = (k: keyof ReportRow) => { if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1)); else { setSortKey(k); setSortDir(-1); } };
  const Th = ({ k, label }: { k: keyof ReportRow; label: string }) => (
    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-400 cursor-pointer select-none hover:text-neutral-700" onClick={() => toggle(k)}>
      {label} {sortKey === k ? (sortDir === -1 ? "↓" : "↑") : ""}
    </th>
  );
  const fmtVal = (v: number) => metric === "time_logged" ? `${v.toFixed(1)}${unit}` : `${Math.round(v)}${unit}`;
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 border-b border-neutral-200">
          <tr>
            <Th k="dimension" label={GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? "Dimension"} />
            <Th k="value" label="Total" />
            <Th k="open" label="Open" />
            <Th k="closed" label="Done" />
            <Th k="pctDone" label="% Done" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.dimension} className={`border-b border-neutral-100 ${i % 2 === 1 ? "bg-neutral-50/50" : ""} hover:bg-indigo-50/40 transition-colors`}>
              <td className="px-3 py-2.5 font-medium text-neutral-800">{dimLabel(row.dimension)}</td>
              <td className="px-3 py-2.5 text-neutral-700 font-semibold">{fmtVal(row.value)}</td>
              <td className="px-3 py-2.5 text-indigo-600">{fmtVal(row.open)}</td>
              <td className="px-3 py-2.5 text-green-600">{fmtVal(row.closed)}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-neutral-200 rounded-full overflow-hidden max-w-[60px]">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${row.pctDone}%` }} />
                  </div>
                  <span className="text-xs text-neutral-500">{row.pctDone}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── CSV export (client-side) ───────────────────────────────────────────────────
function downloadCsv(result: CustomReportResult) {
  const headers = ["Dimension", "Total", "Open", "Done", "% Done"];
  const rows = result.rows.map((r) => [dimLabel(r.dimension), String(Math.round(r.value)), String(Math.round(r.open)), String(Math.round(r.closed)), `${r.pctDone}%`]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `forge-custom-report-${result.from}-${result.to}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CustomReportClient({
  slug,
  projectId: initialProjectId,
  projects,
  sprints,
}: {
  slug: string;
  projectId: string;
  projects: { id: string; name: string }[];
  sprints: { id: string; name: string; projectId: string }[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [metric, setMetric] = useState<Metric>("count");
  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(today);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [trend, setTrend] = useState(false);
  const [dateGroup, setDateGroup] = useState<DateGroup>("week");
  const [compare, setCompare] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("bar-h");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CustomReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(true);
  const [saveName, setSaveName] = useState("");
  const { saved, save: saveReport, remove: removeReport } = useSavedReports(slug);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-select line chart when trend mode is on
  useEffect(() => {
    if (trend) setChartType("line");
    else if (chartType === "line") setChartType("bar-h");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend]);

  const currentConfig = { groupBy, metric, from, to, projectId, trend, dateGroup, compare };

  const run = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ groupBy, metric, from, to, trend: String(trend), dateGroup, compare: String(compare) });
      if (projectId) params.set("project", projectId);
      const res = await fetch(`/api/reports/custom?${params}`, {
        headers: { "x-tenant-slug": slug },
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      setResult(await res.json() as CustomReportResult);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [slug, groupBy, metric, from, to, projectId, trend, dateGroup, compare]);

  const filteredSprints = sprints.filter((s) => !projectId || s.projectId === projectId);
  const unit = METRIC_OPTIONS.find((m) => m.value === metric)?.unit ?? "";

  const summaryCards = (s: ReportSummary, prev?: ReportSummary) => [
    { label: "Total Issues", value: String(s.total), sub: prev ? `vs ${prev.total} prev` : undefined, accent: "#0f172a", prevVal: prev?.total },
    { label: "Open", value: String(s.open), sub: `${100 - s.pctDone}% of total`, accent: "#4f46e5", prevVal: prev?.open },
    { label: "Done", value: String(s.closed), sub: `${s.pctDone}% completion`, accent: "#15803d", prevVal: prev?.closed },
    { label: "Story Points", value: `${s.totalStoryPoints}pts`, sub: undefined, accent: "#7c3aed", prevVal: undefined },
    { label: "Time Logged", value: `${s.totalTimeLoggedHours}h`, sub: undefined, accent: "#0369a1", prevVal: undefined },
    { label: "Avg Cycle", value: s.avgCycleDays != null ? `${s.avgCycleDays}d` : "—", sub: "open → done", accent: "#b45309", prevVal: undefined },
  ];

  return (
    <div className="flex min-h-0 gap-5">
      {/* ── Config sidebar ── */}
      <aside className={`shrink-0 flex flex-col gap-4 transition-all duration-200 ${configOpen ? "w-64" : "w-10"}`}>
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <span className={configOpen ? "" : "rotate-90 inline-block"}>⚙</span>
            {configOpen && <span className="flex-1 text-left ml-2 uppercase tracking-wider">Configure</span>}
            {configOpen && <span className="text-neutral-300">{configOpen ? "◂" : "▸"}</span>}
          </button>

          {configOpen && (
            <div className="px-4 pb-4 space-y-4">
              {/* View mode */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">View</p>
                <div className="flex gap-1.5">
                  {(["breakdown", "trend"] as const).map((v) => (
                    <button key={v} onClick={() => setTrend(v === "trend")}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${(v === "trend") === trend ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                      {v === "breakdown" ? "Breakdown" : "Trend"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group By (hidden in trend mode) */}
              {!trend && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Group By</p>
                  <div className="grid grid-cols-2 gap-1">
                    {GROUP_BY_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => setGroupBy(opt.value)}
                        className={`rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors flex items-center gap-1.5 ${groupBy === opt.value ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"}`}>
                        <span className="text-base leading-none">{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Metric */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Metric</p>
                <div className="space-y-1">
                  {METRIC_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setMetric(opt.value)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${metric === opt.value ? "bg-indigo-600 text-white" : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Date Range</p>
                <div className="space-y-1.5">
                  <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  {[["7d", 7], ["30d", 30], ["90d", 90], ["1y", 365]].map(([label, days]) => (
                    <button key={label} onClick={() => { setFrom(new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10)); setTo(today); }}
                      className="rounded px-2 py-0.5 text-[10px] text-neutral-500 bg-neutral-100 hover:bg-neutral-200 transition-colors">
                      {label}
                    </button>
                  ))}
                  {/* Smart presets */}
                  {(() => {
                    const now = new Date();
                    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
                    const lqStart = new Date(qStart); lqStart.setMonth(lqStart.getMonth() - 3);
                    const lqEnd = new Date(qStart); lqEnd.setDate(lqEnd.getDate() - 1);
                    return (
                      <>
                        <button onClick={() => { setFrom(qStart.toISOString().slice(0, 10)); setTo(qEnd.toISOString().slice(0, 10)); }}
                          className="rounded px-2 py-0.5 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                          This Q
                        </button>
                        <button onClick={() => { setFrom(lqStart.toISOString().slice(0, 10)); setTo(lqEnd.toISOString().slice(0, 10)); }}
                          className="rounded px-2 py-0.5 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                          Last Q
                        </button>
                        <button onClick={() => { const y = now.getFullYear(); setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }}
                          className="rounded px-2 py-0.5 text-[10px] text-neutral-500 bg-neutral-100 hover:bg-neutral-200 transition-colors">
                          YTD
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Project</p>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All Projects</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Date grouping + compare (trend mode) */}
              {trend && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Group By Period</p>
                  <div className="flex gap-1.5">
                    {(["week", "month"] as DateGroup[]).map((v) => (
                      <button key={v} onClick={() => setDateGroup(v)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors capitalize ${dateGroup === v ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <label className="mt-2.5 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="rounded" />
                    <span className="text-xs text-neutral-600">Compare to previous period</span>
                  </label>
                </div>
              )}

              {/* Sprints info (breakdown mode) */}
              {!trend && filteredSprints.length > 0 && groupBy === "sprint" && (
                <div className="rounded-lg bg-indigo-50 px-3 py-2">
                  <p className="text-[10px] text-indigo-600">{filteredSprints.length} sprint{filteredSprints.length !== 1 ? "s" : ""} in scope</p>
                </div>
              )}

              {/* Run button */}
              <button onClick={run} disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm">
                {loading ? "Running…" : "▶  Run Report"}
              </button>
            </div>
          )}
        </div>

        {/* Saved reports */}
        {configOpen && (
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Saved Reports</p>
            {result && (
              <div className="mb-3 flex gap-1.5">
                <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Report name…"
                  className="flex-1 min-w-0 rounded-lg border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={() => { if (saveName.trim()) { saveReport(saveName.trim(), currentConfig); setSaveName(""); } }}
                  disabled={!saveName.trim()}
                  className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                  Save
                </button>
              </div>
            )}
            {saved.length === 0 && <p className="text-[11px] text-neutral-400">No saved reports yet.</p>}
            <div className="space-y-1">
              {saved.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <button onClick={() => { setGroupBy(s.config.groupBy); setMetric(s.config.metric); setFrom(s.config.from); setTo(s.config.to); setProjectId(s.config.projectId); setTrend(s.config.trend); setDateGroup(s.config.dateGroup); setCompare(s.config.compare); }}
                    className="flex-1 min-w-0 truncate text-left text-xs text-neutral-700 hover:text-indigo-600 transition-colors">
                    {s.name}
                  </button>
                  <button onClick={() => removeReport(s.id)} className="text-neutral-300 hover:text-red-400 text-sm transition-colors">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main results area ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Header + exports */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Custom Report Builder</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {trend ? `Trend · ${dateGroup}ly` : `Grouped by ${GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}`} ·{" "}
              {METRIC_OPTIONS.find((m) => m.value === metric)?.label}
              {result ? ` · ${result.from} → ${result.to}` : ""}
            </p>
          </div>
          {result && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => downloadCsv(result)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm">
                📄 CSV
              </button>
              <a href={`/${slug}/reports/custom/export/excel?groupBy=${groupBy}&metric=${metric}&from=${result.from}&to=${result.to}${projectId ? `&project=${projectId}` : ""}&trend=${trend}&dateGroup=${dateGroup}`}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm">
                📊 Excel
              </a>
              <a href={`/${slug}/reports/custom/export/pdf?groupBy=${groupBy}&metric=${metric}&from=${result.from}&to=${result.to}${projectId ? `&project=${projectId}` : ""}&trend=${trend}&dateGroup=${dateGroup}&compare=${compare}`}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm">
                📑 PDF
              </a>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* KPI summary */}
        {result && (
          <div className="flex gap-3 flex-wrap">
            {summaryCards(result.summary, result.previousSummary).map((card, i) => {
              const currVal = i === 0 ? result.summary.total : i === 1 ? result.summary.open : result.summary.closed;
              return (
                <KpiCard key={card.label} label={card.label} value={card.value} sub={card.sub} accent={card.accent}>
                  {card.prevVal !== undefined && <Delta curr={currVal} prev={card.prevVal} />}
                </KpiCard>
              );
            })}
          </div>
        )}

        {/* Chart type selector + chart */}
        {result && (
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-1 border-b border-neutral-100 px-4 py-2">
              {CHART_TYPES.filter((t) => trend ? t === "line" || t === "table" : t !== "line").map((t) => (
                <button key={t} onClick={() => setChartType(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${chartType === t ? "bg-indigo-600 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>
                  <span className="mr-1">{CHART_TYPE_ICONS[t]}</span>{CHART_TYPE_LABELS[t]}
                </button>
              ))}
              <div className="ml-auto text-xs text-neutral-400">{result.summary.total} issues in range</div>
            </div>
            <div className="p-5">
              {chartType === "bar-h" && <HBarChart rows={result.rows} groupBy={result.groupBy} metric={metric} unit={unit} />}
              {chartType === "bar-v" && <VBarChart rows={result.rows} groupBy={result.groupBy} metric={metric} unit={unit} />}
              {chartType === "donut" && <DonutChart rows={result.rows} groupBy={result.groupBy} />}
              {chartType === "line" && result.trend && <LineChart points={result.trend} />}
              {chartType === "table" && <DataTable rows={result.rows} groupBy={result.groupBy} metric={metric} unit={unit} />}
            </div>
          </div>
        )}

        {/* Data table (always shown with chart, except when chart=table) */}
        {result && chartType !== "table" && !trend && result.rows.length > 0 && (
          <DataTable rows={result.rows} groupBy={result.groupBy} metric={metric} unit={unit} />
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="rounded-xl border border-dashed border-neutral-200 py-20 text-center">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-sm font-medium text-neutral-600">Configure your report and click Run</p>
            <p className="text-xs text-neutral-400 mt-1">8 dimensions · 3 metrics · 5 chart types · full export</p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center shadow-sm">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm text-neutral-500">Building report…</p>
          </div>
        )}
      </div>
    </div>
  );
}
