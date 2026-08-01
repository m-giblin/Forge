"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { avatarColor, initials as initialsOf } from "@/lib/ui/avatar";

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

// Ember Rust status colors (HANDOFF.md §3) — used for issue chips instead of
// an invented per-project palette.
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  backlog: { fg: "#a19d90", bg: "#f1efe9" },
  todo: { fg: "#3a6ea8", bg: "#eaf1f8" },
  in_progress: { fg: "#c9791d", bg: "#fdf1de" },
  in_review: { fg: "#7a4fa0", bg: "#f4ecfa" },
  done: { fg: "#3f7d4c", bg: "#e9f3ea" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PRIORITY_DOT: Record<string, string> = {
  urgent: "#c0392b", high: "#c9791d", medium: "#3a6ea8", low: "#a19d90",
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
    <div className="flex flex-col h-full min-h-0 bg-[#eeece4]">
      {/* Header */}
      <div className="shrink-0 bg-[#eeece4] border-b border-[#ddd8c9] px-6 pt-4 pb-[13px]">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-[family-name:var(--font-manrope)] text-[21px] font-extrabold text-[#20201d]">
            {MONTHS[month]} {year}
          </h1>
          <div className="flex items-center gap-[5px]">
            <button onClick={goBack} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1.5 text-xs font-bold text-[#4a473e] hover:bg-[#eae6da] transition-colors">←</button>
            <button onClick={goToday} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-bold text-[#4a473e] hover:bg-[#eae6da] transition-colors">Today</button>
            <button onClick={goForward} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1.5 text-xs font-bold text-[#4a473e] hover:bg-[#eae6da] transition-colors">→</button>
          </div>

          <div className="flex-1" />

          {/* Assignee filter */}
          <span className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Filter</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterMemberId(null)}
              className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${!filterMemberId ? "bg-[#8c4632] text-[#f2e9d8]" : "border border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#eae6da]"}`}
            >
              All
            </button>
            {members.map((m) => (
              <button
                key={m.userId}
                onClick={() => setFilterMemberId(filterMemberId === m.userId ? null : m.userId)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${filterMemberId === m.userId ? "bg-[#8c4632] text-[#f2e9d8]" : "border border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#eae6da]"}`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: filterMemberId === m.userId ? "rgba(255,255,255,0.2)" : avatarColor(m.userId) }}
                >
                  {m.initials || initialsOf(m.name)}
                </span>
                {m.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Sprint bands */}
        {visibleSprints.length > 0 && (
          <div className="flex flex-wrap gap-[7px] mt-[11px]">
            {visibleSprints.map((s) => {
              const color = s.status === "active" ? "#8c4632" : "#726e60";
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[11px] font-bold text-white"
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
      </div>

      {/* Calendar grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3.5 pb-6">
        <div className="grid grid-cols-7 gap-px bg-[#ddd8c9] border border-[#ddd8c9] rounded-md overflow-hidden">
          {DAYS.map((d) => (
            <div key={d} className="bg-[#e3ded0] py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#726e60]">
              {d}
            </div>
          ))}
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={idx} className="bg-[#eeece4] min-h-[96px]" />;
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
                className="min-h-[96px] px-2 py-[7px]"
                style={{ background: isCurrentMonth ? "#f4f2eb" : "#eeece4" }}
              >
                {/* Date number */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11.5px] inline-flex items-center justify-center min-w-[20px] h-5 rounded-full"
                    style={{
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? "#f2e9d8" : isCurrentMonth ? "#726e60" : "#a19d90",
                      background: isToday ? "#8c4632" : "transparent",
                    }}
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
                          style={{ background: s.status === "active" ? "#8c4632" : "#a19d90" }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Issue chips */}
                <div className="flex flex-col gap-[3px] mt-[5px] overflow-hidden">
                  {dayIssues.slice(0, 4).map((issue) => {
                    const color = STATUS_COLORS[issue.status] ?? STATUS_COLORS.backlog;
                    const isHovered = hoveredIssueId === issue.id;
                    return (
                      <Link
                        key={issue.id}
                        href={`/${slug}/issues/${issue.id}`}
                        onMouseEnter={() => setHoveredIssueId(issue.id)}
                        onMouseLeave={() => setHoveredIssueId(null)}
                        className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold truncate transition-colors"
                        style={{
                          background: color.bg,
                          borderLeft: `2.5px solid ${PRIORITY_DOT[issue.priority]}`,
                          color: color.fg,
                          filter: isHovered ? "brightness(0.96)" : undefined,
                        }}
                        title={`${issue.key}: ${issue.title}`}
                      >
                        <span className="font-mono shrink-0">{issue.key}</span>
                        <span className="truncate">{issue.title}</span>
                      </Link>
                    );
                  })}
                  {dayIssues.length > 4 && (
                    <span className="text-[11px] text-[#a19d90] pl-1">+{dayIssues.length - 4} more</span>
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
