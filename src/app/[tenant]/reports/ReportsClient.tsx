"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { ReportsData } from "@/lib/services/reports";

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

function TrendChart({ data }: { data: { label: string; opened: number; closed: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-neutral-400 text-center py-8">No data in range</p>;
  const w = 500, h = 140, pad = 32;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.opened, d.closed)));
  const xStep = (w - pad * 2) / Math.max(1, data.length - 1);
  const y = (v: number) => h - pad - (v / maxVal) * (h - pad * 2);
  const openedPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${y(d.opened)}`).join(" ");
  const closedPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${y(d.closed)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full">
        {[0, maxVal].map((v) => (
          <line key={v} x1={pad} y1={y(v)} x2={w - pad} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <path d={openedPath} fill="none" stroke="#6366f1" strokeWidth="2" />
        <path d={closedPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 2" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={pad + i * xStep} cy={y(d.opened)} r="3" fill="#6366f1" />
            <circle cx={pad + i * xStep} cy={y(d.closed)} r="3" fill="#22c55e" />
            {data.length <= 12 && (
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
  id, active, onToggle, title, subtitle, accentColor = "indigo", children,
}: {
  id: string; active: boolean; onToggle: (id: string) => void;
  title: string; subtitle: string; accentColor?: string; children: React.ReactNode;
}) {
  const ring: Record<string, string> = {
    indigo: "border-indigo-400 ring-1 ring-indigo-100",
    amber:  "border-amber-400  ring-1 ring-amber-100",
    red:    "border-red-400    ring-1 ring-red-100",
    emerald:"border-emerald-400 ring-1 ring-emerald-100",
    sky:    "border-sky-400    ring-1 ring-sky-100",
    violet: "border-violet-400 ring-1 ring-violet-100",
  };
  const hover: Record<string, string> = {
    indigo: "hover:border-indigo-300", amber: "hover:border-amber-300",
    red: "hover:border-red-300", emerald: "hover:border-emerald-300",
    sky: "hover:border-sky-300", violet: "hover:border-violet-300",
  };
  return (
    <div
      onClick={() => onToggle(id)}
      className={`bg-white rounded-xl border p-4 cursor-pointer transition hover:shadow-md ${active ? (ring[accentColor] ?? ring.indigo) : `border-neutral-200 ${hover[accentColor] ?? hover.indigo}`}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <span className="text-[10px] text-neutral-400">{subtitle}</span>
      </div>
      {children}
      <div className={`mt-3 text-[10px] text-center ${active ? "text-indigo-500 font-medium" : "text-neutral-400"}`}>
        {active ? "▾ collapse" : "click to drill down ▾"}
      </div>
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────
export default function ReportsClient({
  slug, data, from, to, projectId,
}: {
  slug: string; data: ReportsData; from: string; to: string; projectId: string;
}) {
  const router = useRouter();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo]     = useState(to);
  const [localProject, setLocalProject] = useState(projectId);
  const [drillWidget, setDrillWidget]   = useState<string | null>(null);

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

  const maxStatus   = Math.max(1, ...data.byStatus.map((b) => b.count));
  const maxPriority = Math.max(1, ...data.byPriority.map((b) => b.count));
  const maxAssignee = Math.max(1, ...data.byAssignee.map((b) => b.count));
  const total = data.totalOpen + data.totalDone || 1;
  const typeTotal = data.byType.reduce((s, t) => s + t.count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Click any widget to drill into the data</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
        </div>
      </div>

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

      {/* Trend chart (full width) */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-800 mb-4">Issues opened vs closed (weekly)</h2>
        <TrendChart data={data.weeklyTrend} />
      </div>

      {/* ── 8-widget grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* 1 — By status */}
        <Widget id="status" active={drillWidget==="status"} onToggle={toggleDrill}
          title="By Status" subtitle="all issues in range" accentColor="indigo">
          {data.byStatus.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No issues in range</p>
            : data.byStatus.map((s) => (
                <HBar key={s.status} label={STATUS_LABELS[s.status] ?? s.status}
                  value={s.count} max={maxStatus} color={STATUS_COLORS[s.status] ?? "#94a3b8"} />
              ))}
        </Widget>

        {/* 2 — By priority */}
        <Widget id="priority" active={drillWidget==="priority"} onToggle={toggleDrill}
          title="By Priority" subtitle="all issues in range" accentColor="amber">
          {data.byPriority.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No issues</p>
            : data.byPriority.map((p) => (
                <HBar key={p.priority} label={p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}
                  value={p.count} max={maxPriority} color={PRIORITY_COLORS[p.priority] ?? "#94a3b8"} />
              ))}
        </Widget>

        {/* 3 — Bug vs Feature vs Task */}
        <Widget id="type" active={drillWidget==="type"} onToggle={toggleDrill}
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
        <Widget id="cycle" active={drillWidget==="cycle"} onToggle={toggleDrill}
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
        <Widget id="assignee" active={drillWidget==="assignee"} onToggle={toggleDrill}
          title="Assignee Load" subtitle="open issues per person" accentColor="sky">
          {data.byAssignee.length === 0
            ? <p className="text-xs text-neutral-400 text-center py-3">No open issues</p>
            : data.byAssignee.map((a) => (
                <HBar key={a.assigneeId ?? "__unassigned__"} label={a.name}
                  value={a.count} max={maxAssignee} color={a.assigneeId ? "#0ea5e9" : "#94a3b8"} />
              ))}
        </Widget>

        {/* 6 — Blocked time */}
        <Widget id="blocked" active={drillWidget==="blocked"} onToggle={toggleDrill}
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
        <Widget id="openclosed" active={drillWidget==="openclosed"} onToggle={toggleDrill}
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

        {/* 8 — Open by assignee (existing, promoted to widget) */}
        <Widget id="assignee-list" active={drillWidget==="assignee-list"} onToggle={toggleDrill}
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

      {/* ── Drill-down panel ── */}
      {drillWidget && (
        <div className="bg-white rounded-xl border-2 border-indigo-300 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-neutral-900">
              {drillWidget === "status"       && "🔍 Issues by Status — Full Breakdown"}
              {drillWidget === "priority"     && "🔍 Issues by Priority"}
              {drillWidget === "type"         && "🔍 Bug vs Feature — Issue List"}
              {drillWidget === "cycle"        && "🔍 Cycle Time — In-Flight Issues"}
              {drillWidget === "assignee"     && "🔍 Assignee Load — Open Issues"}
              {drillWidget === "blocked"      && "🔍 Blocked Issues — Detail"}
              {drillWidget === "openclosed"   && "🔍 Open Issues — What Remains"}
              {drillWidget === "assignee-list"&& "🔍 Workload — Per Person"}
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/${slug}/issues`}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline">
                Open Issues list →
              </Link>
              <button onClick={() => setDrillWidget(null)} className="text-neutral-400 hover:text-neutral-700 text-xs">
                ✕ Close
              </button>
            </div>
          </div>

          {/* Blocked drill-down shows blocked issue cards */}
          {drillWidget === "blocked" && (
            <div className="space-y-2">
              {data.blockedIssues.length === 0
                ? <p className="text-sm text-neutral-500 text-center py-6">No blocked issues — great work!</p>
                : data.blockedIssues.map((b) => (
                    <Link key={b.id} href={`/${slug}/issues/${b.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition">
                      <span className="text-[11px] font-mono text-red-400 w-[72px] shrink-0">{b.key}</span>
                      <span className="text-sm text-neutral-800 flex-1 truncate">{b.title}</span>
                      <span className="text-xs text-neutral-500 shrink-0">{b.assigneeName}</span>
                      <span className="text-xs font-bold text-red-600 shrink-0">{b.daysOld}d blocked</span>
                    </Link>
                  ))}
            </div>
          )}

          {/* Other drills link into filtered issues list */}
          {drillWidget !== "blocked" && (
            <div>
              <p className="text-sm text-neutral-600 mb-3">
                {drillWidget === "openclosed" && `${data.openCount} open issues in this date range.`}
                {drillWidget === "type" && `${typeTotal} total issues — ${data.byType.map(t => `${t.count} ${t.type}s`).join(", ")}.`}
                {drillWidget === "cycle" && `Average cycle time: ${data.avgCycleDays ?? "—"} days from creation to done.`}
                {(drillWidget === "status" || drillWidget === "priority" || drillWidget === "assignee" || drillWidget === "assignee-list") &&
                  `${data.totalOpen} open issues across ${data.byAssignee.filter(a => a.assigneeId).length} assignees.`}
              </p>
              <div className="grid gap-2">
                {drillWidget === "status" && data.byStatus.map((s) => (
                  <Link key={s.status} href={`/${slug}/issues?status=${s.status}`}
                    className="flex items-center gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition">
                    <span className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[s.status] ?? "#94a3b8" }} />
                    <span className="text-sm text-neutral-800 flex-1">{STATUS_LABELS[s.status] ?? s.status}</span>
                    <span className="text-sm font-bold text-neutral-600">{s.count}</span>
                  </Link>
                ))}
                {drillWidget === "priority" && data.byPriority.map((p) => (
                  <Link key={p.priority} href={`/${slug}/issues?priority=${p.priority}`}
                    className="flex items-center gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition">
                    <span className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: PRIORITY_COLORS[p.priority] ?? "#94a3b8" }} />
                    <span className="text-sm text-neutral-800 flex-1 capitalize">{p.priority}</span>
                    <span className="text-sm font-bold text-neutral-600">{p.count}</span>
                  </Link>
                ))}
                {(drillWidget === "assignee" || drillWidget === "assignee-list") && data.byAssignee.map((a) => (
                  <div key={a.assigneeId ?? "__unassigned__"}
                    className="flex items-center gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
                    <span className="text-sm text-neutral-800 flex-1">{a.name}</span>
                    <span className="text-sm font-bold text-neutral-600">{a.count} open</span>
                  </div>
                ))}
                {(drillWidget === "type") && data.byType.map((t) => (
                  <div key={t.type} className="flex items-center gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[t.type] ?? "#94a3b8" }} />
                    <span className="text-sm text-neutral-800 flex-1 capitalize">{t.type}</span>
                    <span className="text-sm font-bold text-neutral-600">{t.count}</span>
                  </div>
                ))}
                {drillWidget === "openclosed" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <div className="text-2xl font-bold text-emerald-700">{data.closedCount}</div>
                      <div className="text-xs text-emerald-600 mt-1">Closed in range</div>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                      <div className="text-2xl font-bold text-red-600">{data.openCount}</div>
                      <div className="text-xs text-red-500 mt-1">Still open</div>
                    </div>
                  </div>
                )}
                {drillWidget === "cycle" && data.cycleByStage.map((s) => (
                  <div key={s.label} className="flex items-center gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
                    <span className="text-sm text-neutral-800 flex-1">{s.label}</span>
                    <span className="text-sm font-bold text-violet-600">{s.avgDays}d avg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
