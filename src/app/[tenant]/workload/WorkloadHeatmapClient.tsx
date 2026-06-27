"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type HeatMember = {
  userId: string;
  name: string;
  initials: string;
  hoursPerWeek: number;
};

export type HeatIssue = {
  id: string;
  key: string;
  title: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  startDate: string;
  dueDate: string;
  projectId: string;
  projectName: string;
  timeEstimateMinutes: number | null;
  storyPoints: number | null;
};

const WEEKS = 16;
const COL_W = 200;
const CELL_W = 80;
const ROW_H = 64;

const PRIORITY_DOT: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#6366f1", low: "#94a3b8",
};

function toUTCDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() - (day === 0 ? 6 : day - 1));
  return copy;
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function heatColor(pct: number): { bg: string; text: string; label: string } {
  if (pct === 0) return { bg: "#f8fafc", text: "#94a3b8", label: "—" };
  if (pct <= 0.5) return { bg: "#dcfce7", text: "#166534", label: `${Math.round(pct * 100)}%` };
  if (pct <= 0.8) return { bg: "#bbf7d0", text: "#14532d", label: `${Math.round(pct * 100)}%` };
  if (pct <= 1.0) return { bg: "#fef9c3", text: "#713f12", label: `${Math.round(pct * 100)}%` };
  if (pct <= 1.2) return { bg: "#fed7aa", text: "#7c2d12", label: `${Math.round(pct * 100)}%` };
  return { bg: "#fecaca", text: "#7f1d1d", label: `${Math.round(pct * 100)}%` };
}

export default function WorkloadHeatmapClient({
  slug, members, issues,
}: {
  slug: string;
  members: HeatMember[];
  issues: HeatIssue[];
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeCell, setActiveCell] = useState<{ memberId: string; weekIdx: number } | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of issues) seen.set(i.projectId, i.projectName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [issues]);

  // Week grid: WEEKS weeks starting from current Monday + offset
  const gridStart = useMemo(() => {
    const base = mondayOf(new Date());
    base.setUTCDate(base.getUTCDate() + weekOffset * 7);
    base.setUTCHours(0, 0, 0, 0);
    return base;
  }, [weekOffset]);

  const weeks = useMemo(() =>
    Array.from({ length: WEEKS }, (_, i) => {
      const start = addDays(gridStart, i * 7);
      const end = addDays(start, 6);
      return { start, end, startIso: isoOf(start), endIso: isoOf(end) };
    }),
    [gridStart]
  );

  const todayIso = isoOf(new Date());

  // Issues filtered by project
  const filteredIssues = projectFilter
    ? issues.filter((i) => i.projectId === projectFilter)
    : issues;

  // For each (member, week): list of overlapping issues
  const cellIssues = useMemo(() => {
    const map = new Map<string, HeatIssue[]>();
    for (const member of members) {
      for (let w = 0; w < WEEKS; w++) {
        const week = weeks[w];
        const key = `${member.userId}:${w}`;
        const list = filteredIssues.filter(
          (i) =>
            i.assigneeId === member.userId &&
            i.startDate <= week.endIso &&
            i.dueDate >= week.startIso
        );
        map.set(key, list);
      }
    }
    return map;
  }, [members, weeks, filteredIssues]);

  // For each (member, week): total hours allocated
  const cellHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const member of members) {
      for (let w = 0; w < WEEKS; w++) {
        const key = `${member.userId}:${w}`;
        const list = cellIssues.get(key) ?? [];
        const week = weeks[w];
        const weekDays = 5; // working days
        // Distribute each issue's estimate proportionally across its working days
        let total = 0;
        for (const issue of list) {
          const issueDays = Math.max(1, Math.round(
            (toUTCDate(issue.dueDate).getTime() - toUTCDate(issue.startDate).getTime()) / 86400000
          ) * 5 / 7); // rough working days
          const issueWeekOverlap = weekDays; // simplified: assume full week overlap
          if (issue.timeEstimateMinutes) {
            total += (issue.timeEstimateMinutes / 60) * (issueWeekOverlap / Math.max(issueDays, issueWeekOverlap));
          } else if (issue.storyPoints) {
            // Assume 2h per point
            total += (issue.storyPoints * 2) * (issueWeekOverlap / Math.max(issueDays, issueWeekOverlap));
          } else {
            // No estimate: count as 4h placeholder
            total += 4;
          }
        }
        map.set(key, Math.round(total * 10) / 10);
      }
    }
    return map;
  }, [cellIssues, members, weeks]);

  const activeCellIssues = activeCell
    ? (cellIssues.get(`${activeCell.memberId}:${activeCell.weekIdx}`) ?? [])
    : [];
  const activeMember = activeCell ? members.find((m) => m.userId === activeCell.memberId) : null;
  const activeWeek = activeCell ? weeks[activeCell.weekIdx] : null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-neutral-900">Resource Capacity</h1>
          <span className="text-xs text-neutral-400">Cross-project workload heat map</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Project filter */}
          <select
            value={projectFilter ?? ""}
            onChange={(e) => setProjectFilter(e.target.value || null)}
            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset((o) => o - WEEKS)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition">←</button>
            <button onClick={() => setWeekOffset(0)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">Today</button>
            <button onClick={() => setWeekOffset((o) => o + WEEKS)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition">→</button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 text-[10px]">
            {[
              { bg: "#dcfce7", label: "< 50%" },
              { bg: "#fef9c3", label: "80–100%" },
              { bg: "#fed7aa", label: "100–120%" },
              { bg: "#fecaca", label: "> 120%" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: l.bg, border: "1px solid #e5e7eb" }} />
                <span className="text-neutral-500">{l.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Heat map */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ minWidth: COL_W + WEEKS * CELL_W }}>
            {/* Week headers */}
            <div className="flex sticky top-0 z-10 bg-white border-b border-neutral-200">
              <div className="shrink-0 border-r border-neutral-200 bg-neutral-50 flex items-end px-4 pb-2" style={{ width: COL_W, height: 56 }}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Team member</span>
              </div>
              {weeks.map((week, i) => {
                const isThisWeek = week.startIso <= todayIso && todayIso <= week.endIso;
                return (
                  <div
                    key={i}
                    className="shrink-0 flex flex-col items-center justify-end pb-1.5 border-r border-neutral-100"
                    style={{ width: CELL_W, height: 56, background: isThisWeek ? "#fefce8" : "transparent" }}
                  >
                    <span className={`text-[11px] font-medium ${isThisWeek ? "text-amber-700 font-semibold" : "text-neutral-500"}`}>
                      {week.start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    {isThisWeek && <span className="text-[9px] text-amber-600 font-semibold">This week</span>}
                  </div>
                );
              })}
            </div>

            {/* Member rows */}
            {members.map((member) => (
              <div key={member.userId} className="flex" style={{ height: ROW_H, borderBottom: "1px solid #f1f5f9" }}>
                {/* Member name */}
                <div className="shrink-0 border-r border-neutral-200 flex items-center gap-2.5 px-4 sticky left-0 bg-white z-[5]" style={{ width: COL_W }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-indigo-100 text-indigo-700 shrink-0">
                    {member.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">{member.name}</div>
                    <div className="text-[10px] text-neutral-400">{member.hoursPerWeek}h/wk capacity</div>
                  </div>
                </div>

                {/* Heat cells */}
                {weeks.map((week, w) => {
                  const key = `${member.userId}:${w}`;
                  const hours = cellHours.get(key) ?? 0;
                  const pct = member.hoursPerWeek > 0 ? hours / member.hoursPerWeek : 0;
                  const cell = heatColor(pct);
                  const count = (cellIssues.get(key) ?? []).length;
                  const isActive = activeCell?.memberId === member.userId && activeCell?.weekIdx === w;
                  const isThisWeek = week.startIso <= todayIso && todayIso <= week.endIso;

                  return (
                    <button
                      key={w}
                      onClick={() => setActiveCell(isActive ? null : { memberId: member.userId, weekIdx: w })}
                      className="shrink-0 flex flex-col items-center justify-center border-r border-neutral-100 transition-all hover:ring-2 hover:ring-inset hover:ring-indigo-300"
                      style={{
                        width: CELL_W,
                        background: isActive ? "#e0e7ff" : isThisWeek && pct === 0 ? "#fefce8" : cell.bg,
                        outline: isActive ? "2px solid #6366f1" : undefined,
                        outlineOffset: -2,
                      }}
                    >
                      {pct > 0 && (
                        <>
                          <span className="text-sm font-bold" style={{ color: cell.text }}>{cell.label}</span>
                          <span className="text-[10px]" style={{ color: cell.text }}>{count} issue{count !== 1 ? "s" : ""} · {hours}h</span>
                        </>
                      )}
                      {pct === 0 && (
                        <span className="text-[11px]" style={{ color: cell.text }}>—</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel: cell details */}
        {activeCell && activeMember && activeWeek && (
          <div className="w-72 border-l border-neutral-200 bg-white flex flex-col shrink-0 overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-neutral-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  {activeWeek.start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  {" – "}
                  {activeWeek.end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                </span>
                <button onClick={() => setActiveCell(null)} className="text-neutral-300 hover:text-neutral-600 text-sm">✕</button>
              </div>
              <p className="text-sm font-semibold text-neutral-900">{activeMember.name}</p>
              <p className="text-xs text-neutral-400">{activeCellIssues.length} issue{activeCellIssues.length !== 1 ? "s" : ""} · {activeMember.hoursPerWeek}h/wk capacity</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {activeCellIssues.length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-8">No issues this week</p>
              )}
              {activeCellIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/${slug}/issues/${issue.id}`}
                  onClick={() => setActiveCell(null)}
                  className="flex items-start gap-2 rounded-lg border border-neutral-100 px-3 py-2.5 hover:bg-neutral-50 transition group"
                >
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: PRIORITY_DOT[issue.priority] }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono font-semibold text-indigo-600">{issue.key}</span>
                      <span className="text-[10px] text-neutral-400 truncate">{issue.projectName}</span>
                    </div>
                    <p className="text-xs text-neutral-700 truncate group-hover:text-neutral-900">{issue.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {issue.timeEstimateMinutes && (
                        <span className="text-[10px] text-neutral-400">⏱ {Math.round(issue.timeEstimateMinutes / 60 * 10) / 10}h</span>
                      )}
                      {issue.storyPoints && !issue.timeEstimateMinutes && (
                        <span className="text-[10px] text-neutral-400">{issue.storyPoints}pt</span>
                      )}
                      <span className="text-[10px] text-neutral-400">
                        {toUTCDate(issue.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                        {" – "}
                        {toUTCDate(issue.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
