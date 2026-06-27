"use client";

import { useState, useEffect, useTransition } from "react";
import { loadTimeReportData, type TimeReportData, type TimeReportSprint } from "./timeReports";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtMins(m: number): string {
  if (m === 0) return "0h";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Mode = "sprint" | "week" | "month" | "custom";

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(data: TimeReportData, label: string) {
  const rows = [
    ["Date", "Member", "Issue", "Title", "Project", "Minutes", "Hours", "Billable", "Tag", "Note"],
    ...data.logs.map((l) => [
      l.loggedAt.slice(0, 10),
      l.userName,
      l.issueKey,
      `"${l.issueTitle.replace(/"/g, '""')}"`,
      l.projectKey,
      l.minutes,
      (l.minutes / 60).toFixed(2),
      l.billable ? "Yes" : "No",
      l.tag ?? "",
      `"${(l.note ?? "").replace(/"/g, '""')}"`,
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `time-report-${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── bar chart ─────────────────────────────────────────────────────────────────

function HorizBar({ label, value, max, billable, total }: { label: string; value: number; max: number; billable: number; total: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const billPct = value > 0 ? Math.round((billable / value) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-neutral-50 last:border-0">
      <span className="w-32 shrink-0 text-sm font-medium text-neutral-800 truncate" title={label}>{label}</span>
      <div className="flex-1 relative h-6 bg-neutral-100 rounded overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-indigo-500 rounded"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {billable > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-emerald-400 rounded opacity-60"
            style={{ width: `${Math.min((billable / (max || 1)) * 100, 100)}%` }}
          />
        )}
        <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white mix-blend-overlay">
          {fmtMins(value)}
        </span>
      </div>
      <span className="w-12 text-right text-xs text-neutral-500 tabular-nums">{pct}%</span>
      <span className="w-16 text-right text-xs text-emerald-600 tabular-nums">
        {billable > 0 ? `${billPct}% bill.` : "—"}
      </span>
    </div>
  );
}

// ── sparkline ─────────────────────────────────────────────────────────────────

function DailySparkline({ points }: { points: { date: string; minutes: number }[] }) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.minutes), 1);
  const W = 600, H = 80, PAD = 12;
  const xStep = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${PAD + i * xStep} ${y(p.minutes)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
        <line x1={PAD} y1={y(max)} x2={W - PAD} y2={y(max)} stroke="#f1f5f9" strokeWidth={1} />
        <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="#f1f5f9" strokeWidth={1} />
        {/* fill area */}
        <path
          d={`${path} L ${PAD + (points.length - 1) * xStep} ${H - PAD} L ${PAD} ${H - PAD} Z`}
          fill="#6366f1" fillOpacity={0.08}
        />
        <path d={path} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={PAD + i * xStep} cy={y(p.minutes)} r={3} fill="#6366f1" />
        ))}
        {points.length <= 14 && points.map((p, i) => (
          <text key={i} x={PAD + i * xStep} y={H + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">
            {fmtDate(p.date).replace(/\s/, " ")}
          </text>
        ))}
      </svg>
      <div className="flex gap-4 justify-end text-xs text-neutral-400 mt-1">
        <span>Peak: {fmtMins(max)}</span>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  slug: string;
  initialSprints: TimeReportSprint[];
  activeSprint: TimeReportSprint | null;
}

export default function TimeReportsTab({ slug, initialSprints, activeSprint }: Props) {
  const [mode, setMode] = useState<Mode>(activeSprint ? "sprint" : "week");
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(activeSprint?.id ?? null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<TimeReportData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [filterMember, setFilterMember] = useState<string | null>(null);

  function load(m: Mode, sid: string | null, from: string, to: string) {
    startTransition(async () => {
      const result = await loadTimeReportData(slug, m, sid, from || null, to || null);
      setData(result);
      if (result.sprints.length > 0 && initialSprints.length === 0) {
        // sprints loaded fresh — update sprint selector default
      }
    });
  }

  // Auto-load on mount
  useEffect(() => {
    load(mode, selectedSprintId, customFrom, customTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModeChange(m: Mode) {
    setMode(m);
    if (m !== "sprint") setSelectedSprintId(null);
    if (m !== "custom") {
      load(m, m === "sprint" ? selectedSprintId : null, "", "");
    }
  }

  function handleSprintChange(id: string) {
    setSelectedSprintId(id);
    load("sprint", id, "", "");
  }

  function handleCustomApply() {
    if (customFrom && customTo) load("custom", null, customFrom, customTo);
  }

  // Filter logs by member if selected
  const filteredLogs = filterMember
    ? (data?.logs ?? []).filter((l) => l.userId === filterMember)
    : (data?.logs ?? []);

  const displayedLogs = expandedLogs ? filteredLogs : filteredLogs.slice(0, 10);

  // Current sprint label for export
  const sprintLabel = mode === "sprint" && selectedSprintId
    ? (data?.sprints ?? initialSprints).find((s) => s.id === selectedSprintId)?.name ?? "sprint"
    : mode;

  const totalMins = filterMember
    ? (data?.logs ?? []).filter((l) => l.userId === filterMember).reduce((s, l) => s + l.minutes, 0)
    : (data?.totalMinutes ?? 0);
  const billMins = filterMember
    ? (data?.logs ?? []).filter((l) => l.userId === filterMember && l.billable).reduce((s, l) => s + l.minutes, 0)
    : (data?.billableMinutes ?? 0);

  const allSprints = data?.sprints ?? initialSprints;

  return (
    <div className="space-y-6">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mode chips */}
        {(["sprint", "week", "month", "custom"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              mode === m
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {m === "sprint" ? "Sprint" : m === "week" ? "This Week" : m === "month" ? "This Month" : "Custom"}
          </button>
        ))}

        {/* Sprint selector */}
        {mode === "sprint" && (
          <select
            value={selectedSprintId ?? ""}
            onChange={(e) => handleSprintChange(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {allSprints.length === 0 && <option value="">No sprints</option>}
            {allSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.status === "active" ? "▶ " : ""}{s.name} ({s.projectKey})
              </option>
            ))}
          </select>
        )}

        {/* Custom date range */}
        {mode === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <span className="text-xs text-neutral-400">→</span>
            <input
              type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={handleCustomApply}
              disabled={!customFrom || !customTo}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-indigo-700"
            >
              Apply
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isPending && (
            <span className="text-xs text-neutral-400 animate-pulse">Loading…</span>
          )}
          {data && (
            <button
              onClick={() => exportCsv(data, sprintLabel)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition"
            >
              ↓ Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Member filter pill (click on member to filter logs) ── */}
      {filterMember && data && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500">Showing:</span>
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-indigo-700 font-semibold">
            {data.members.find((m) => m.userId === filterMember)?.name}
          </span>
          <button
            onClick={() => setFilterMember(null)}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* ── Summary tiles ── */}
      {!data && !isPending && (
        <p className="text-sm text-neutral-400 py-8 text-center">No data yet — start logging time on issues.</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Total Hours",
                value: fmtMins(totalMins),
                sub: `${Math.round(totalMins / 60 * 10) / 10}h across ${filteredLogs.length} log${filteredLogs.length !== 1 ? "s" : ""}`,
                color: "text-indigo-700",
              },
              {
                label: "Billable",
                value: fmtMins(billMins),
                sub: totalMins > 0 ? `${Math.round((billMins / totalMins) * 100)}% of total` : "0%",
                color: "text-emerald-700",
              },
              {
                label: "Non-Billable",
                value: fmtMins(totalMins - billMins),
                sub: totalMins > 0 ? `${Math.round(((totalMins - billMins) / totalMins) * 100)}% of total` : "0%",
                color: "text-neutral-700",
              },
              {
                label: "Contributors",
                value: String(filterMember ? 1 : data.members.length),
                sub: filterMember
                  ? data.members.find((m) => m.userId === filterMember)?.name ?? ""
                  : `${data.projects.length} project${data.projects.length !== 1 ? "s" : ""}`,
                color: "text-neutral-700",
              },
            ].map((tile) => (
              <div key={tile.label} className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{tile.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${tile.color}`}>{tile.value}</p>
                <p className="mt-0.5 text-xs text-neutral-400">{tile.sub}</p>
              </div>
            ))}
          </div>

          {totalMins === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-neutral-500">No time logged in this period.</p>
              <p className="text-xs text-neutral-400 mt-1">Start tracking time on issues using the ▶ Start Timer button or manual log entries.</p>
            </div>
          ) : (
            <>
              {/* ── Daily trend ── */}
              {data.dailyTrend.length > 1 && !filterMember && (
                <div className="rounded-xl border border-neutral-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">Daily Hours</p>
                  <DailySparkline points={data.dailyTrend} />
                </div>
              )}

              {/* ── By member ── */}
              {!filterMember && data.members.length > 0 && (
                <div className="rounded-xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">By Team Member</p>
                    <p className="text-xs text-neutral-400">Click a row to filter logs below</p>
                  </div>
                  <div className="mb-2 flex items-center gap-3 px-1 text-xs text-neutral-400">
                    <span className="w-32" />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-indigo-500" /> Total</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-emerald-400 opacity-60" /> Billable</span>
                    </div>
                  </div>
                  <div>
                    {data.members.map((m) => (
                      <button
                        key={m.userId}
                        onClick={() => setFilterMember(m.userId)}
                        className="w-full text-left hover:bg-neutral-50 rounded-lg px-1 transition"
                      >
                        <HorizBar
                          label={m.name}
                          value={m.totalMinutes}
                          max={data.members[0].totalMinutes}
                          billable={m.billableMinutes}
                          total={data.totalMinutes}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── By project ── */}
              {!filterMember && data.projects.length > 1 && (
                <div className="rounded-xl border border-neutral-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">By Project</p>
                  <div>
                    {data.projects.map((p) => (
                      <HorizBar
                        key={p.projectKey}
                        label={`${p.projectKey} · ${p.projectName}`}
                        value={p.totalMinutes}
                        max={data.projects[0].totalMinutes}
                        billable={p.billableMinutes}
                        total={data.totalMinutes}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Log detail ── */}
              <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Log Detail {filterMember ? `(${data.members.find((m) => m.userId === filterMember)?.name})` : ""}
                  </p>
                  <span className="text-xs text-neutral-400">{filteredLogs.length} entries</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-neutral-50 text-left">
                      {["Date", "Member", "Issue", "Hours", "Billable", "Tag", "Note"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-neutral-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLogs.map((log) => (
                      <tr key={log.logId} className="border-t border-neutral-50 hover:bg-neutral-50">
                        <td className="px-4 py-2.5 text-neutral-500 tabular-nums whitespace-nowrap">
                          {fmtDate(log.loggedAt)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-neutral-800">{log.userName}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-indigo-600 mr-1.5">{log.issueKey}</span>
                          <span className="text-neutral-600 truncate max-w-[200px] inline-block align-bottom" title={log.issueTitle}>
                            {log.issueTitle}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-neutral-800 tabular-nums">{fmtMins(log.minutes)}</td>
                        <td className="px-4 py-2.5">
                          {log.billable ? (
                            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-700 font-semibold">Bill.</span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-500">{log.tag ?? "—"}</td>
                        <td className="px-4 py-2.5 text-neutral-400 max-w-[180px] truncate" title={log.note ?? ""}>
                          {log.note ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No entries for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {filteredLogs.length > 10 && (
                  <div className="border-t border-neutral-100 px-5 py-3 text-center">
                    <button
                      onClick={() => setExpandedLogs(!expandedLogs)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {expandedLogs ? "Show less" : `Show all ${filteredLogs.length} entries`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
