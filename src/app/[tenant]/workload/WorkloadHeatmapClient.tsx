"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { avatarColor } from "@/lib/ui/avatar";

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
  urgent: "#c0392b", high: "#c9791d", medium: "#3a6ea8", low: "#a19d90",
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

// Heat tiers follow the prototype's capacity-row breakpoints
// (Sprint Board Redesign.dc.html, screenVals() "team" branch, heat(): 50/80/100/120)
// but use only the §3 status-color tokens instead of the prototype's one-off hex values.
function heatColor(pct: number): { bg: string; text: string; label: string } {
  const p = pct * 100;
  if (pct === 0) return { bg: "#f1efe9", text: "#a19d90", label: "—" };
  if (p <= 50) return { bg: "#e9f3ea", text: "#3f7d4c", label: `${Math.round(p)}%` };
  if (p <= 80) return { bg: "#f1efe9", text: "#a19d90", label: `${Math.round(p)}%` };
  if (p <= 120) return { bg: "#fdf1de", text: "#c9791d", label: `${Math.round(p)}%` };
  return { bg: "#fbeae8", text: "#c0392b", label: `${Math.round(p)}%` };
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
    <div className="flex flex-col h-full min-h-0 bg-[#eeece4]">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 pb-[13px] border-b border-[#ddd8c9] shrink-0 flex-wrap gap-3.5">
        <div>
          <h1 className="text-[21px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">Team</h1>
          <p className="mt-0.5 text-[12.5px] text-[#726e60]">Resource capacity — committed hours vs availability, per week</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Project filter */}
          <select
            value={projectFilter ?? ""}
            onChange={(e) => setProjectFilter(e.target.value || null)}
            className="rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] px-2 py-1.5 text-xs text-[#4a473e] focus:outline-none focus:ring-2 focus:ring-[#8c4632]/40"
          >
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset((o) => o - WEEKS)} className="rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1.5 text-sm text-[#4a473e] hover:bg-[#eae6da] transition">←</button>
            <button onClick={() => setWeekOffset(0)} className="rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-xs font-medium text-[#4a473e] hover:bg-[#eae6da] transition">Today</button>
            <button onClick={() => setWeekOffset((o) => o + WEEKS)} className="rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1.5 text-sm text-[#4a473e] hover:bg-[#eae6da] transition">→</button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-[9px] text-[10.5px]">
            {[
              { bg: "#e9f3ea", label: "< 50%" },
              { bg: "#f1efe9", label: "50–80%" },
              { bg: "#fdf1de", label: "80–120%" },
              { bg: "#fbeae8", label: "> 120%" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-[5px]">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: l.bg, border: "1px solid #ddd8c9" }} />
                <span className="text-[#726e60]">{l.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 p-3.5 pt-[14px]">
        {/* Heat map */}
        <div className="fw-card flex-1 overflow-x-auto overflow-y-auto" style={{ minWidth: 820 }}>
          <div style={{ minWidth: COL_W + WEEKS * CELL_W }}>
            {/* Week headers */}
            <div className="flex sticky top-0 z-10 bg-[#eae6da] border-b border-[#e3ded0]">
              <div className="shrink-0 border-r border-[#e3ded0] bg-[#eae6da] flex items-end px-4 pb-2" style={{ width: COL_W, height: 56 }}>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Team member</span>
              </div>
              {weeks.map((week, i) => {
                const isThisWeek = week.startIso <= todayIso && todayIso <= week.endIso;
                return (
                  <div
                    key={i}
                    className="shrink-0 flex flex-col items-center justify-end pb-1.5 border-r border-[#e3ded0]"
                    style={{ width: CELL_W, height: 56, background: isThisWeek ? "#fdf1de" : "transparent" }}
                  >
                    <span className={`text-[10.5px] font-medium ${isThisWeek ? "text-[#c9791d] font-semibold" : "text-[#a19d90]"}`}>
                      {week.start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    {isThisWeek && <span className="text-[9px] text-[#c9791d] font-semibold">This week</span>}
                  </div>
                );
              })}
            </div>

            {/* Member rows */}
            {members.map((member) => (
              <div key={member.userId} className="flex" style={{ height: ROW_H, borderBottom: "1px solid #e3ded0" }}>
                {/* Member name */}
                <div className="shrink-0 border-r border-[#e3ded0] flex items-center gap-2.5 px-4 sticky left-0 bg-[#f4f2eb] z-[5]" style={{ width: COL_W }}>
                  <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ backgroundColor: avatarColor(member.userId) }}>
                    {member.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-[#20201d] truncate">{member.name}</div>
                    <div className="text-[10.5px] text-[#a19d90]">{member.hoursPerWeek}h/wk capacity</div>
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
                      className="shrink-0 flex flex-col items-center justify-center border-r border-[#e3ded0] transition-all hover:ring-2 hover:ring-inset hover:ring-[#8c4632]/40"
                      style={{
                        width: CELL_W,
                        background: isActive ? "#f4ecfa" : isThisWeek && pct === 0 ? "#fdf1de" : cell.bg,
                        outline: isActive ? "2px solid #7a4fa0" : undefined,
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
          <div className="w-72 fw-card ml-3.5 flex flex-col shrink-0 overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[#e3ded0]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[#726e60] uppercase tracking-wide">
                  {activeWeek.start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  {" – "}
                  {activeWeek.end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                </span>
                <button onClick={() => setActiveCell(null)} className="text-[#a19d90] hover:text-[#4a473e] text-sm">✕</button>
              </div>
              <p className="text-sm font-semibold text-[#20201d]">{activeMember.name}</p>
              <p className="text-xs text-[#a19d90]">{activeCellIssues.length} issue{activeCellIssues.length !== 1 ? "s" : ""} · {activeMember.hoursPerWeek}h/wk capacity</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {activeCellIssues.length === 0 && (
                <p className="text-xs text-[#a19d90] text-center py-8">No issues this week</p>
              )}
              {activeCellIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/${slug}/issues/${issue.id}`}
                  onClick={() => setActiveCell(null)}
                  className="flex items-start gap-2 rounded-lg border border-[#e3ded0] px-3 py-2.5 hover:bg-[#eae6da] transition group"
                >
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: PRIORITY_DOT[issue.priority] }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono font-semibold text-[#8c4632]">{issue.key}</span>
                      <span className="text-[10px] text-[#a19d90] truncate">{issue.projectName}</span>
                    </div>
                    <p className="text-xs text-[#4a473e] truncate group-hover:text-[#20201d]">{issue.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {issue.timeEstimateMinutes && (
                        <span className="text-[10px] text-[#a19d90]">⏱ {Math.round(issue.timeEstimateMinutes / 60 * 10) / 10}h</span>
                      )}
                      {issue.storyPoints && !issue.timeEstimateMinutes && (
                        <span className="text-[10px] text-[#a19d90]">{issue.storyPoints}pt</span>
                      )}
                      <span className="text-[10px] text-[#a19d90]">
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
