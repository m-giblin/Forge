"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type CalIssue = {
  id: string;
  key: string;
  title: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  projectId: string;
};

export type CalSprint = {
  id: string;
  name: string;
  projectId: string;
  startDate: string | null;
  endDate: string | null;
  status: "planned" | "active" | "completed";
};

export type CalMember = {
  userId: string;
  name: string;
  initials: string;
};

const PROJECT_COLORS = [
  { bg: "#eef2ff", border: "#818cf8", text: "#3730a3" },
  { bg: "#f5f3ff", border: "#a78bfa", text: "#4c1d95" },
  { bg: "#f0fdfa", border: "#2dd4bf", text: "#134e4a" },
  { bg: "#fffbeb", border: "#fbbf24", text: "#78350f" },
  { bg: "#fff1f2", border: "#fb7185", text: "#881337" },
  { bg: "#ecfdf5", border: "#34d399", text: "#064e3b" },
  { bg: "#f0f9ff", border: "#38bdf8", text: "#0c4a6e" },
  { bg: "#fff7ed", border: "#fb923c", text: "#7c2d12" },
];

const SPRINT_COLORS = ["#6366f1", "#8b5cf6", "#14b8a6", "#f59e0b", "#f43f5e", "#10b981", "#0ea5e9", "#f97316"];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PRIORITY_DOT: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#6366f1", low: "#94a3b8",
};

function toUTCDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export default function CalendarClient({
  slug, members, issues, sprints,
}: {
  slug: string;
  members: CalMember[];
  issues: CalIssue[];
  sprints: CalSprint[];
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth()); // 0-indexed
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);

  // Project color map
  const projectColorMap = useMemo(() => {
    const ids = [...new Set(issues.map((i) => i.projectId))];
    return new Map(ids.map((id, i) => [id, PROJECT_COLORS[i % PROJECT_COLORS.length]]));
  }, [issues]);

  // Sprint color map
  const sprintColorMap = useMemo(() => {
    return new Map(sprints.map((s, i) => [s.id, SPRINT_COLORS[i % SPRINT_COLORS.length]]));
  }, [sprints]);

  // Build calendar grid
  const firstDay = new Date(Date.UTC(year, month, 1));
  const startDayOfWeek = firstDay.getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // Grid cells: pad to full weeks
  const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
  const cells: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startDayOfWeek + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return new Date(Date.UTC(year, month, dayNum));
  });

  // Issues filtered by assignee
  const visibleIssues = filterMemberId
    ? issues.filter((i) => i.assigneeId === filterMemberId)
    : issues;

  // Map: iso date → issues due on that date
  const issuesByDate = useMemo(() => {
    const m = new Map<string, CalIssue[]>();
    for (const issue of visibleIssues) {
      if (issue.dueDate) {
        const k = issue.dueDate;
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(issue);
      }
    }
    return m;
  }, [visibleIssues]);

  // Sprints that overlap this month
  const monthStart = isoOf(firstDay);
  const monthEnd = isoOf(new Date(Date.UTC(year, month, daysInMonth)));
  const visibleSprints = sprints.filter(
    (s) => s.startDate && s.endDate && s.startDate <= monthEnd && s.endDate >= monthStart
  );

  const todayIso = isoOf(now);

  const goBack = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const goForward = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const goToday = () => { setYear(now.getUTCFullYear()); setMonth(now.getUTCMonth()); };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-neutral-900">
            {MONTHS[month]} {year}
          </h1>
          <div className="flex items-center gap-1">
            <button onClick={goBack} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition">←</button>
            <button onClick={goToday} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">Today</button>
            <button onClick={goForward} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition">→</button>
          </div>
        </div>

        {/* Assignee filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide">Filter:</span>
          <button
            onClick={() => setFilterMemberId(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${!filterMemberId ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
          >
            All
          </button>
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => setFilterMemberId(filterMemberId === m.userId ? null : m.userId)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${filterMemberId === m.userId ? "bg-indigo-600 text-white" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${filterMemberId === m.userId ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                {m.initials}
              </span>
              {m.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Sprint bands */}
      {visibleSprints.length > 0 && (
        <div className="px-4 py-2 border-b border-neutral-100 bg-neutral-50 flex flex-wrap gap-2">
          {visibleSprints.map((s) => {
            const color = sprintColorMap.get(s.id) ?? "#6366f1";
            return (
              <div
                key={s.id}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                style={{ background: color }}
              >
                {s.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />}
                {s.name}
                {s.startDate && s.endDate && (
                  <span className="opacity-70">
                    {toUTCDate(s.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    {" – "}
                    {toUTCDate(s.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-neutral-200 shrink-0">
        {DAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: "minmax(120px, 1fr)" }}>
          {cells.map((date, idx) => {
            if (!date) {
              return (
                <div key={idx} className="border-b border-r border-neutral-100 bg-neutral-50/50" />
              );
            }

            const iso = isoOf(date);
            const isToday = iso === todayIso;
            const isCurrentMonth = date.getUTCMonth() === month;
            const dayIssues = issuesByDate.get(iso) ?? [];

            // Sprint coverage for this day
            const daySprints = visibleSprints.filter(
              (s) => s.startDate && s.endDate && s.startDate <= iso && s.endDate >= iso
            );

            return (
              <div
                key={idx}
                className={`border-b border-r border-neutral-100 p-1 flex flex-col gap-0.5 ${isCurrentMonth ? "bg-white" : "bg-neutral-50/60"}`}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-xs font-semibold flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-neutral-700" : "text-neutral-300"}`}
                  >
                    {date.getUTCDate()}
                  </span>
                  {/* Sprint dot indicators */}
                  {daySprints.length > 0 && (
                    <div className="flex gap-0.5">
                      {daySprints.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          title={s.name}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: sprintColorMap.get(s.id) ?? "#6366f1" }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Issue chips */}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayIssues.slice(0, 4).map((issue) => {
                    const color = projectColorMap.get(issue.projectId) ?? PROJECT_COLORS[0];
                    const isHovered = hoveredIssueId === issue.id;
                    return (
                      <Link
                        key={issue.id}
                        href={`/${slug}/issues/${issue.id}`}
                        onMouseEnter={() => setHoveredIssueId(issue.id)}
                        onMouseLeave={() => setHoveredIssueId(null)}
                        className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate transition"
                        style={{
                          background: isHovered ? color.border + "40" : color.bg,
                          borderLeft: `2.5px solid ${PRIORITY_DOT[issue.priority]}`,
                          color: color.text,
                        }}
                        title={`${issue.key}: ${issue.title}`}
                      >
                        <span className="font-mono shrink-0">{issue.key}</span>
                        <span className="truncate text-neutral-600">{issue.title}</span>
                      </Link>
                    );
                  })}
                  {dayIssues.length > 4 && (
                    <span className="text-[10px] text-neutral-400 pl-1">+{dayIssues.length - 4} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
