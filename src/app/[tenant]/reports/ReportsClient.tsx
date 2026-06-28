"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { ReportsData } from "@/lib/services/reports";
import type { TimeReportSprint } from "./timeReports";
import TimeReportsTab from "./TimeReportsTab";

// ── colour maps ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog", todo: "Todo", in_progress: "In Progress",
  in_review: "In Review", done: "Done",
};
const STATUS_COLORS: Record<string, string> = {
  backlog: "#94a3b8", todo: "#64748b", in_progress: "#6366f1",
  in_review: "#8b5cf6", done: "#22c55e",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};
const TYPE_COLORS: Record<string, string> = {
  bug: "#ef4444", feature: "#6366f1", task: "#94a3b8",
};

// ── sub-components ───────────────────────────────────────────────────────────
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 truncate text-right text-neutral-600 text-xs">{label}</span>
      <div className="flex-1 h-5 bg-neutral-100 rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-6 text-right text-xs font-medium text-neutral-700">{value}</span>
    </div>
  );
}

function TrendChart({ data, compact }: { data: { label: string; opened: number; closed: number }[]; compact?: boolean }) {
  if (data.length === 0) return <p className="text-xs text-neutral-400 text-center py-8">No data in range</p>;
  const w = 500, h = compact ? 70 : 140, pad = compact ? 16 : 32;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.opened, d.closed)));
  const xStep = (w - pad * 2) / Math.max(1, data.length - 1);
  const y = (v: number) => h - pad - (v / maxVal) * (h - pad * 2);
  const openedPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${y(d.opened)}`).join(" ");
  const closedPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${y(d.closed)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + (compact ? 0 : 24)}`} className="w-full">
        {[0, maxVal].map((v) => (
          <line key={v} x1={pad} y1={y(v)} x2={w - pad} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <path d={openedPath} fill="none" stroke="#6366f1" strokeWidth="2" />
        <path d={closedPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 2" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={pad + i * xStep} cy={y(d.opened)} r={compact ? 2 : 3} fill="#6366f1" />
            <circle cx={pad + i * xStep} cy={y(d.closed)} r={compact ? 2 : 3} fill="#22c55e" />
            {!compact && data.length <= 12 && (
              <text x={pad + i * xStep} y={h + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex gap-4 justify-center text-xs text-neutral-500 mt-1">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-indigo-500" />Opened</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-green-500" />Closed</span>
      </div>
    </div>
  );
}

// ── widget wrapper ───────────────────────────────────────────────────────────
function Widget({
  id, onToggle, title, subtitle, accentColor = "indigo", children,
}: {
  id: string; onToggle: (id: string) => void;
  title: string; subtitle: string; accentColor?: string; children: React.ReactNode;
}) {
  const hover: Record<string, string> = {
    indigo: "hover:border-indigo-300", amber: "hover:border-amber-300",
    red: "hover:border-red-300", emerald: "hover:border-emerald-300",
    sky: "hover:border-sky-300", violet: "hover:border-violet-300",
  };
  return (
    <div
      onClick={() => onToggle(id)}
      className={`bg-white rounded-xl border border-neutral-200 p-4 cursor-pointer transition hover:shadow-md group ${hover[accentColor] ?? hover.indigo}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <span className="text-[10px] text-neutral-400 group-hover:text-indigo-500 transition">{subtitle} · details ↗</span>
      </div>
      {children}
    </div>
  );
}

type SavedReport = { name: string; from: string; to: string; projectId: string; savedAt: string };
const SAVED_KEY = "forge:saved_reports";

function loadSaved(slug: string): SavedReport[] {
  try { return JSON.parse(localStorage.getItem(`${SAVED_KEY}:${slug}`) ?? "[]"); } catch { return []; }
}
function saveSaved(slug: string, reports: SavedReport[]) {
  localStorage.setItem(`${SAVED_KEY}:${slug}`, JSON.stringify(reports));
}

// ── main component ───────────────────────────────────────────────────────────
export default function ReportsClient({
  slug, data, from, to, projectId, initialSprints = [], activeSprint = null,
}: {
  slug: string; data: ReportsData; from: string; to: string; projectId: string;
  initialSprints?: TimeReportSprint[];
  activeSprint?: TimeReportSprint | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"issues" | "time">("issues");
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo]     = useState(to);
  const [localProject, setLocalProject] = useState(projectId);
  const [drillWidget, setDrillWidget]   = useState<string | null>(null);
  const [chartModal, setChartModal]     = useState<"trend" | "throughput" | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Load saved reports from localStorage on mount (setTimeout defers past render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setSavedReports(loadSaved(slug)), 0); return () => clearTimeout(t); }, []);

  function applyFilters() {
    const p = new URLSearchParams();
    if (localFrom) p.set("from", localFrom);
    if (localTo)   p.set("to", localTo);
    if (localProject) p.set("project", localProject);
    router.push(`/${slug}/reports?${p.toString()}`);
  }

  function toggleDrill(id: string) {
    setDrillWidget(prev => prev === id ? null : id);
  }

  function saveReport() {
    const name = saveNameInput.trim();
    if (!name) return;
    const next = [
      { name, from: localFrom, to: localTo, projectId: localProject, savedAt: new Date().toISOString() },
      ...savedReports.filter((r) => r.name !== name),
    ].slice(0, 10);
    saveSaved(slug, next);
    setSavedReports(next);
    setSaveNameInput("");
    setShowSaveForm(false);
  }

  function loadReport(r: SavedReport) {
    const p = new URLSearchParams();
    if (r.from) p.set("from", r.from);
    if (r.to)   p.set("to", r.to);
    if (r.projectId) p.set("project", r.projectId);
    router.push(`/${slug}/reports?${p.toString()}`);
  }

  function deleteReport(name: string) {
    const next = savedReports.filter((r) => r.name !== name);
    saveSaved(slug, next);
    setSavedReports(next);
  }

  const maxStatus   = Math.max(1, ...data.byStatus.map((b) => b.count));
  const maxPriority = Math.max(1, ...data.byPriority.map((b) => b.count));
  const maxAssignee = Math.max(1, ...data.byAssignee.map((b) => b.count));
  const total = data.totalOpen + data.totalDone || 1;
  const typeTotal = data.byType.reduce((s, t) => s + t.count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header + tabs */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
          <div className="flex gap-1 mt-2 border-b border-neutral-200">
            {(["issues", "time"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab === "issues" ? "Issues" : "⏱ Time"}
              </button>
            ))}
          </div>
        </div>
        <div className={`ml-auto flex flex-wrap items-center gap-2 ${activeTab === "time" ? "hidden" : ""}`}>
          <select value={localProject} onChange={(e) => setLocalProject(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">All projects</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
          <span className="text-neutral-400 text-sm">→</span>
          <input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white" />
          <button onClick={applyFilters}
            className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">
            Apply
          </button>
          {/* Export buttons */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white overflow-hidden">
            <a
              href={`/${slug}/reports/export/excel?from=${localFrom}&to=${localTo}${localProject ? `&project=${localProject}` : ""}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
              title="Export as Excel dashboard"
            >
              <span className="text-base">📊</span> Excel
            </a>
            <div className="w-px h-6 bg-neutral-200" />
            <a
              href={`/${slug}/reports/export/pdf?from=${localFrom}&to=${localTo}${localProject ? `&project=${localProject}` : ""}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-700 hover:bg-red-50 hover:text-red-700 transition-colors"
              title="Export as PDF (C-Suite)"
            >
              <span className="text-base">📄</span> PDF
            </a>
          </div>
          <button onClick={() => setShowSaveForm((s) => !s)}
            className="px-3 py-1.5 text-sm border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg font-medium">
            💾 Save
          </button>
          {savedReports.length > 0 && (
            <div className="relative group">
              <button className="px-3 py-1.5 text-sm border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg font-medium">
                📋 My Reports ({savedReports.length})
              </button>
              <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:block w-64 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
                {savedReports.map((r) => (
                  <div key={r.name} className="flex items-center gap-1 px-3 py-2 hover:bg-neutral-50">
                    <button onClick={() => loadReport(r)} className="flex-1 text-left text-sm text-neutral-800 truncate">
                      {r.name}
                      <span className="ml-1 text-[10px] text-neutral-400">
                        {r.from}→{r.to}
                      </span>
                    </button>
                    <button onClick={() => deleteReport(r.name)} className="text-neutral-300 hover:text-red-500 text-xs px-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showSaveForm && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-indigo-100 bg-indigo-50">
          <span className="text-sm text-indigo-700 font-medium shrink-0">Save as:</span>
          <input
            value={saveNameInput}
            onChange={(e) => setSaveNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveReport()}
            placeholder="e.g. Q2 Sprint Review"
            className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
          <button onClick={saveReport} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
            Save
          </button>
          <button onClick={() => setShowSaveForm(false)} className="text-sm text-neutral-500 hover:text-neutral-700">
            Cancel
          </button>
        </div>
      )}

      {/* Time Reports Tab */}
      {activeTab === "time" && (
        <TimeReportsTab slug={slug} initialSprints={initialSprints} activeSprint={activeSprint} />
      )}

      {/* Issues tab content */}
      {activeTab === "issues" && (<>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open issues",      value: data.totalOpen,   color: "text-indigo-600" },
          { label: "Closed in range",  value: data.totalDone,   color: "text-green-600"  },
          { label: "Blocked",          value: data.blockedIssues.length, color: data.blockedIssues.length > 0 ? "text-red-600" : "text-neutral-700" },
          { label: "Avg cycle time",   value: data.avgCycleDays != null ? `${data.avgCycleDays}d` : "—", color: "text-purple-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Compact chart row (click to expand) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Trend chart */}
        <button
          onClick={() => setChartModal("trend")}
          className="bg-white rounded-xl border border-neutral-200 p-4 text-left hover:border-indigo-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800">Opened vs Closed (weekly)</h2>
            <span className="text-[10px] text-neutral-400 group-hover:text-indigo-500 transition">click to expand ↗</span>
          </div>
          <TrendChart data={data.weeklyTrend} compact />
        </button>

        {/* Throughput chart */}
        {data.weeklyTrend.length > 0 && (
          <button
            onClick={() => setChartModal("throughput")}
            className="bg-white rounded-xl border border-neutral-200 p-4 text-left hover:border-indigo-300 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-neutral-800">Throughput (closed/week)</h2>
              <span className="text-[10px] text-neutral-400 group-hover:text-indigo-500 transition">
                avg {Math.round(data.weeklyTrend.reduce((s, w) => s + w.closed, 0) / data.weeklyTrend.length * 10) / 10}/wk · click to expand ↗
              </span>
            </div>
            {(() => {
              const maxClosed = Math.max(1, ...data.weeklyTrend.map((w) => w.closed));
              return (
                <div className="flex items-end gap-1 h-16">
                  {data.weeklyTrend.map((w, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                      <div className="w-full rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(4, (w.closed / maxClosed) * 100)}%`,
                          backgroundColor: w.closed === 0 ? "#f1f5f9" : w.closed >= maxClosed * 0.8 ? "#22c55e" : w.closed >= maxClosed * 0.4 ? "#6366f1" : "#94a3b8",
                        }}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </button>
        )}
      </div>

      {/* ── Chart modal ── */}
      {chartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setChartModal(null)}
        >
          <div
            className="bg-white rounded-2xl border border-neutral-200 shadow-2xl w-full max-w-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-neutral-900">
                {chartModal === "trend" ? "Issues Opened vs Closed (weekly)" : "Throughput — Issues Closed per Week"}
              </h2>
              <button onClick={() => setChartModal(null)} className="text-neutral-400 hover:text-neutral-700 text-sm px-2 py-1 rounded-lg hover:bg-neutral-100">
                ✕ Close
              </button>
            </div>

            {chartModal === "trend" && <TrendChart data={data.weeklyTrend} />}

            {chartModal === "throughput" && (() => {
              const maxClosed = Math.max(1, ...data.weeklyTrend.map((w) => w.closed));
              return (
                <>
                  <p className="text-xs text-neutral-400 mb-4">Higher is faster. Target: consistent bar heights with no sudden drops.</p>
                  <div className="flex items-end gap-1.5 h-40">
                    {data.weeklyTrend.map((w, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <span className="text-[9px] text-neutral-500 font-medium">{w.closed > 0 ? w.closed : ""}</span>
                        <div className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${Math.max(4, (w.closed / maxClosed) * 100)}%`,
                            backgroundColor: w.closed === 0 ? "#f1f5f9" : w.closed >= maxClosed * 0.8 ? "#22c55e" : w.closed >= maxClosed * 0.4 ? "#6366f1" : "#94a3b8",
                          }}
                        />
                        {data.weeklyTrend.length <= 16 && (
                          <span className="text-[9px] text-neutral-400 truncate w-full text-center">{w.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── 8-widget grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* 1 — By status */}
        <Widget id="status" onToggle={toggleDrill}
          title="By Status" subtitle="all issues in range" accentColor="indigo">
          {data.byStatus.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No issues in range</p>
            : data.byStatus.map((s) => (
                <HBar key={s.status} label={STATUS_LABELS[s.status] ?? s.status}
                  value={s.count} max={maxStatus} color={STATUS_COLORS[s.status] ?? "#94a3b8"} />
              ))}
        </Widget>

        {/* 2 — By priority */}
        <Widget id="priority" onToggle={toggleDrill}
          title="By Priority" subtitle="all issues in range" accentColor="amber">
          {data.byPriority.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No issues</p>
            : data.byPriority.map((p) => (
                <HBar key={p.priority} label={p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}
                  value={p.count} max={maxPriority} color={PRIORITY_COLORS[p.priority] ?? "#94a3b8"} />
              ))}
        </Widget>

        {/* 3 — Bug vs Feature vs Task */}
        <Widget id="type" onToggle={toggleDrill}
          title="Bug vs Feature" subtitle="by issue type" accentColor="red">
          {data.byType.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No issues</p>
            : (
              <div>
                <div className="flex h-5 rounded-full overflow-hidden mb-3">
                  {data.byType.map((t) => (
                    <div key={t.type} className="flex items-center justify-center text-[9px] text-white font-bold"
                      style={{ width: `${(t.count / typeTotal) * 100}%`, backgroundColor: TYPE_COLORS[t.type] ?? "#94a3b8" }}>
                      {t.count}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {data.byType.map((t) => (
                    <span key={t.type} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TYPE_COLORS[t.type] ?? "#94a3b8" }}/>
                      {t.type.charAt(0).toUpperCase() + t.type.slice(1)} {Math.round((t.count / typeTotal) * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
        </Widget>

        {/* 4 — Cycle time */}
        <Widget id="cycle" onToggle={toggleDrill}
          title="Cycle Time" subtitle="avg days per stage" accentColor="violet">
          {data.avgCycleDays == null && data.cycleByStage.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No completed issues yet</p>
            : (
              <div className="space-y-2">
                {data.cycleByStage.map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-[10px] text-neutral-500 mb-0.5">
                      <span>{s.label}</span>
                      <strong className="text-neutral-800">{s.avgDays}d avg</strong>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full"
                        style={{ width: `${Math.min(100, (s.avgDays / 10) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {data.avgCycleDays != null && (
                  <p className="text-[11px] text-neutral-500 pt-1">
                    Overall avg: <strong className="text-neutral-800">{data.avgCycleDays}d</strong> created → done
                  </p>
                )}
              </div>
            )}
        </Widget>

        {/* 5 — Assignee load */}
        <Widget id="assignee" onToggle={toggleDrill}
          title="Assignee Load" subtitle="open issues per person" accentColor="sky">
          {data.byAssignee.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No open issues</p>
            : data.byAssignee.map((a) => (
                <HBar key={a.assigneeId ?? "__unassigned__"} label={a.name}
                  value={a.count} max={maxAssignee} color={a.assigneeId ? "#0ea5e9" : "#94a3b8"} />
              ))}
        </Widget>

        {/* 6 — Blocked time */}
        <Widget id="blocked" onToggle={toggleDrill}
          title="Blocked Issues" subtitle="days issues sat blocked" accentColor="red">
          {data.blockedIssues.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">🎉 No blocked issues</p>
            : (
              <div className="space-y-1.5">
                {data.blockedIssues.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-400 w-[64px] shrink-0">{b.key}</span>
                    <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full"
                        style={{ width: `${Math.min(100, (b.daysOld / 14) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-red-600 font-medium w-6 text-right">{b.daysOld}d</span>
                  </div>
                ))}
                <p className="text-[11px] text-neutral-500 pt-1">
                  Total: <strong className="text-red-600">{data.blockedDaysTotal}d</strong> blocked across {data.blockedIssues.length} issues
                </p>
              </div>
            )}
        </Widget>

        {/* 7 — Open vs Closed */}
        <Widget id="openclosed" onToggle={toggleDrill}
          title="Open vs Closed" subtitle="in selected range" accentColor="emerald">
          <div className="flex flex-col items-center justify-center gap-3 py-2">
            <div className="flex w-full h-4 rounded-full overflow-hidden">
              <div className="bg-emerald-400 transition-all" style={{ width: `${(data.closedCount / total) * 100}%` }} />
              <div className="bg-red-300 transition-all" style={{ width: `${(data.openCount / total) * 100}%` }} />
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Closed {data.closedCount}
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-300 inline-block" /> Open {data.openCount}
              </span>
            </div>
          </div>
        </Widget>

        {/* 8 — Workload Distribution */}
        <Widget id="assignee-list" onToggle={toggleDrill}
          title="Workload Distribution" subtitle="open issues by assignee" accentColor="indigo">
          {data.byAssignee.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No open issues</p>
            : data.byAssignee.slice(0, 5).map((a) => (
                <HBar key={a.assigneeId ?? "__unassigned__"} label={a.name}
                  value={a.count} max={maxAssignee}
                  color={a.assigneeId ? "#6366f1" : "#94a3b8"} />
              ))}
        </Widget>
      </div>

      {/* ── Drill-down modal ── */}
      {drillWidget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDrillWidget(null)}
        >
          <div
            className="bg-white rounded-2xl border border-neutral-200 shadow-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-neutral-900">
                {drillWidget === "status"        && "Issues by Status"}
                {drillWidget === "priority"      && "Issues by Priority"}
                {drillWidget === "type"          && "Bug vs Feature vs Task"}
                {drillWidget === "cycle"         && "Cycle Time Breakdown"}
                {drillWidget === "assignee"      && "Assignee Load"}
                {drillWidget === "blocked"       && "Blocked Issues"}
                {drillWidget === "openclosed"    && "Open vs Closed"}
                {drillWidget === "assignee-list" && "Workload Distribution"}
              </h2>
              <div className="flex items-center gap-3">
                {(drillWidget === "status" || drillWidget === "priority" || drillWidget === "assignee" || drillWidget === "assignee-list") && (
                  <Link href={`/${slug}/issues`} onClick={() => setDrillWidget(null)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline">
                    Open Issues list →
                  </Link>
                )}
                <button onClick={() => setDrillWidget(null)}
                  className="text-neutral-400 hover:text-neutral-700 text-sm px-2 py-1 rounded-lg hover:bg-neutral-100">
                  ✕
                </button>
              </div>
            </div>

            {/* Status */}
            {drillWidget === "status" && (
              <div className="grid gap-2">
                {data.byStatus.map((s) => (
                  <Link key={s.status} href={`/${slug}/issues?status=${s.status}`} onClick={() => setDrillWidget(null)}
                    className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.status] ?? "#94a3b8" }} />
                    <span className="text-sm text-neutral-800 flex-1">{STATUS_LABELS[s.status] ?? s.status}</span>
                    <span className="text-sm font-bold text-neutral-700">{s.count}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Priority */}
            {drillWidget === "priority" && (
              <div className="grid gap-2">
                {data.byPriority.map((p) => (
                  <Link key={p.priority} href={`/${slug}/issues?priority=${p.priority}`} onClick={() => setDrillWidget(null)}
                    className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PRIORITY_COLORS[p.priority] ?? "#94a3b8" }} />
                    <span className="text-sm text-neutral-800 flex-1 capitalize">{p.priority}</span>
                    <span className="text-sm font-bold text-neutral-700">{p.count}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Type */}
            {drillWidget === "type" && (
              <div className="grid gap-2">
                <p className="text-xs text-neutral-500 mb-1">{typeTotal} total issues</p>
                {data.byType.map((t) => (
                  <div key={t.type} className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[t.type] ?? "#94a3b8" }} />
                    <span className="text-sm text-neutral-800 flex-1 capitalize">{t.type}</span>
                    <span className="text-xs text-neutral-500">{Math.round((t.count / typeTotal) * 100)}%</span>
                    <span className="text-sm font-bold text-neutral-700">{t.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cycle time */}
            {drillWidget === "cycle" && (
              <div className="grid gap-2">
                {data.cycleByStage.map((s) => (
                  <div key={s.label} className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <span className="text-sm text-neutral-800 flex-1">{s.label}</span>
                    <span className="text-sm font-bold text-violet-600">{s.avgDays}d avg</span>
                  </div>
                ))}
                {data.avgCycleDays != null && (
                  <div className="mt-2 px-3 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-center">
                    <span className="text-sm text-violet-700">Overall avg: </span>
                    <span className="text-sm font-bold text-violet-800">{data.avgCycleDays}d</span>
                    <span className="text-xs text-violet-500"> created → done</span>
                  </div>
                )}
              </div>
            )}

            {/* Assignee / Workload */}
            {(drillWidget === "assignee" || drillWidget === "assignee-list") && (
              <div className="grid gap-2">
                {data.byAssignee.map((a) => (
                  <div key={a.assigneeId ?? "__unassigned__"}
                    className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <span className="text-sm text-neutral-800 flex-1">{a.name}</span>
                    <span className="text-sm font-bold text-neutral-700">{a.count} open</span>
                  </div>
                ))}
              </div>
            )}

            {/* Blocked */}
            {drillWidget === "blocked" && (
              <div className="grid gap-2">
                {data.blockedIssues.length === 0
                  ? <p className="text-sm text-neutral-500 text-center py-6">No blocked issues — great work!</p>
                  : data.blockedIssues.map((b) => (
                      <Link key={b.id} href={`/${slug}/issues/${b.id}`} onClick={() => setDrillWidget(null)}
                        className="flex items-center gap-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition">
                        <span className="text-[11px] font-mono text-red-400 w-[72px] shrink-0">{b.key}</span>
                        <span className="text-sm text-neutral-800 flex-1 truncate">{b.title}</span>
                        <span className="text-xs text-neutral-500 shrink-0">{b.assigneeName}</span>
                        <span className="text-xs font-bold text-red-600 shrink-0">{b.daysOld}d</span>
                      </Link>
                    ))}
              </div>
            )}

            {/* Open vs Closed */}
            {drillWidget === "openclosed" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <div className="text-3xl font-bold text-emerald-700">{data.closedCount}</div>
                  <div className="text-xs text-emerald-600 mt-1">Closed in range</div>
                </div>
                <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
                  <div className="text-3xl font-bold text-red-600">{data.openCount}</div>
                  <div className="text-xs text-red-500 mt-1">Still open</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      </>)} {/* end issues tab */}
    </div>
  );
}
