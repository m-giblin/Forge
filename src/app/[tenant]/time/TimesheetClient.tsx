"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  getWeeklyTimesheetAction,
  getActiveTimerAction,
  stopTimerAction,
  submitTimesheetAction,
  requestTimeOffAction,
  getMyTimeOffRequestsAction,
} from "./actions";
import LogTimeModal from "./LogTimeModal";
import QuickAddModal from "./QuickAddModal";
import RecurringEntriesPanel from "./RecurringEntriesPanel";
import {
  fmtMinutes, getWeekDates, addWeeks, fmtDateHeader, fmtWeekRange, todayStr, isCurrentWeek, elapsedDisplay,
  type WeekData, type LogEntry, type IssueEntry,
} from "./timeHelpers";

interface Props {
  slug: string;
  weekStart: string;
  initialWeekData: WeekData;
  activeTimer: Awaited<ReturnType<typeof getActiveTimerAction>>;
  isPremium: boolean;
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function TimesheetClient({ slug, weekStart: initialWeekStart, initialWeekData, activeTimer: initialActiveTimer, isPremium }: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [weekData, setWeekData] = useState<WeekData>(initialWeekData);
  const [activeTimer, setActiveTimer] = useState(initialActiveTimer);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [stoppingTimer, setStoppingTimer] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitted" | "error">("idle");
  const [submitPending, startSubmit] = useTransition();
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const ROWS_PER_PAGE = 10;
  const [entryPage, setEntryPage] = useState(1);

  // Time off state
  const [showTimeOff, setShowTimeOff] = useState(false);
  const [ptoType, setPtoType] = useState("pto");
  const [ptoStart, setPtoStart] = useState("");
  const [ptoEnd, setPtoEnd] = useState("");
  const [ptoNotes, setPtoNotes] = useState("");
  const [ptoRequests, setPtoRequests] = useState<Awaited<ReturnType<typeof getMyTimeOffRequestsAction>>>([]);
  const [ptoPending, startPto] = useTransition();
  const [ptoError, setPtoError] = useState<string | null>(null);

  // Modal state
  const [logModal, setLogModal] = useState<{
    issueId: string;
    issueTitle: string;
    issueKey: string | null;
    date: string;
    existingLog?: LogEntry;
  } | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const weekDates = getWeekDates(weekStart);
  const today = todayStr();

  // Load time-off requests up front (not just when the modal opens) so the
  // inline "Time off" panel always has data, matching the prototype's
  // always-visible panel rather than hiding it behind a click.
  useEffect(() => {
    if (!isPremium) return;
    getMyTimeOffRequestsAction(slug).then(setPtoRequests);
  }, [slug, isPremium]);

  // Live timer tick
  useEffect(() => {
    if (!activeTimer) return;
    const update = () => setElapsed(elapsedDisplay(activeTimer.startedAt));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  // Navigate weeks
  const navigateWeek = useCallback(async (n: number) => {
    const newStart = addWeeks(weekStart, n);
    setLoadingWeek(true);
    setWeekStart(newStart);
    setEntryPage(1);
    const data = await getWeeklyTimesheetAction(slug, newStart);
    setWeekData(data);
    setLoadingWeek(false);
  }, [weekStart, slug]);

  const entryPageCount = Math.max(1, Math.ceil(weekData.entries.length / ROWS_PER_PAGE));
  const currentEntryPage = Math.min(entryPage, entryPageCount);
  const pagedEntries = weekData.entries.slice((currentEntryPage - 1) * ROWS_PER_PAGE, currentEntryPage * ROWS_PER_PAGE);

  // Stop timer
  async function handleStopTimer() {
    setStoppingTimer(true);
    await stopTimerAction(slug);
    setActiveTimer(null);
    // Refresh week data (stop logs time)
    const data = await getWeeklyTimesheetAction(slug, weekStart);
    setWeekData(data);
    setStoppingTimer(false);
  }

  // Update weekData after logging time
  function handleLogSuccess(entry: { issueId: string; date: string; minutes: number; note: string | null; billable: boolean; id: string }) {
    setWeekData(prev => {
      const newEntries = [...prev.entries];
      const eIdx = newEntries.findIndex(e => e.issueId === entry.issueId);

      if (entry.minutes === 0) {
        // Deletion
        if (eIdx >= 0) {
          const updated = newEntries[eIdx].logs.filter(l => l.id !== entry.id);
          if (updated.length === 0) {
            newEntries.splice(eIdx, 1);
          } else {
            newEntries[eIdx] = { ...newEntries[eIdx], logs: updated };
          }
        }
      } else {
        // New log
        const newLog: LogEntry = { id: entry.id, date: entry.date, minutes: entry.minutes, note: entry.note, billable: entry.billable };
        if (eIdx >= 0) {
          newEntries[eIdx] = { ...newEntries[eIdx], logs: [...newEntries[eIdx].logs, newLog] };
        } else {
          // Issue not in this week's entries — refresh from server for simplicity
          getWeeklyTimesheetAction(slug, weekStart).then(setWeekData);
          return prev;
        }
      }

      const totalMinutes = newEntries.reduce((sum, e) => sum + e.logs.reduce((s, l) => s + l.minutes, 0), 0);
      return { entries: newEntries, totalMinutes };
    });
  }

  // Handle quick-add success (new issue not yet in week)
  function handleQuickAddSuccess(entry: {
    issueId: string; issueKey: string | null; issueTitle: string; projectName: string | null;
    date: string; minutes: number; note: string | null; billable: boolean; id: string;
  }) {
    setWeekData(prev => {
      const newEntries = [...prev.entries];
      const eIdx = newEntries.findIndex(e => e.issueId === entry.issueId);
      const newLog: LogEntry = { id: entry.id, date: entry.date, minutes: entry.minutes, note: entry.note, billable: entry.billable };

      if (eIdx >= 0) {
        newEntries[eIdx] = { ...newEntries[eIdx], logs: [...newEntries[eIdx].logs, newLog] };
      } else {
        newEntries.push({
          issueId: entry.issueId,
          issueKey: entry.issueKey,
          issueTitle: entry.issueTitle,
          projectName: entry.projectName,
          logs: [newLog],
        });
      }

      const totalMinutes = newEntries.reduce((sum, e) => sum + e.logs.reduce((s, l) => s + l.minutes, 0), 0);
      return { entries: newEntries, totalMinutes };
    });
  }

  const hasLoggedThisWeek = isCurrentWeek(weekStart) && weekData.totalMinutes > 0;
  const showReminderBanner = isCurrentWeek(weekStart) && !hasLoggedThisWeek && !reminderDismissed && !activeTimer;

  // Build per-issue, per-day minute sums
  function getDayMinutes(entry: IssueEntry, date: string): number {
    return entry.logs.filter(l => l.date === date).reduce((s, l) => s + l.minutes, 0);
  }

  function getDayLog(entry: IssueEntry, date: string): LogEntry | undefined {
    return entry.logs.find(l => l.date === date);
  }

  function getColTotal(date: string): number {
    return weekData.entries.reduce((sum, e) => sum + getDayMinutes(e, date), 0);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-[#eeece4]">

      {/* Active Timer Banner */}
      {activeTimer && (
        <div className="flex items-center gap-3 border-b border-[#ddd8c9] bg-[#fdf1de] px-6 py-2.5">
          <span className="text-base">⏱</span>
          <span className="text-[12.5px] text-[#4a473e]">
            <span className="font-semibold">Timer running</span>
            {activeTimer.issueKey && (
              <> on <Link href={`/${slug}/issues/${activeTimer.issueId}`} className="font-bold text-[#8c4632] hover:underline">{activeTimer.issueKey}</Link>:</>
            )}
            {activeTimer.issueName && <> {activeTimer.issueName}</>}
          </span>
          <span className="ml-1 font-mono text-[12.5px] font-semibold text-[#c9791d] tabular-nums">{elapsed}</span>
          <div className="ml-auto">
            <button
              onClick={handleStopTimer}
              disabled={stoppingTimer}
              className="rounded-[5px] px-3 py-1.5 text-xs font-bold text-[#f2e9d8] transition-colors disabled:opacity-50"
              style={{ background: "#8c4632", backgroundImage: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}
            >
              {stoppingTimer ? "Stopping…" : "Stop"}
            </button>
          </div>
        </div>
      )}

      {showReminderBanner && (
        <div className="flex items-center gap-3 border-b border-[#ddd8c9] bg-[#eaf1f8] px-6 py-2.5">
          <span className="text-base">📋</span>
          <span className="flex-1 text-[12.5px] text-[#3a6ea8]">
            You haven&apos;t logged any time this week. Start tracking ↓
          </span>
          <button
            onClick={() => setReminderDismissed(true)}
            className="ml-auto text-[#a19d90] hover:text-[#4a473e] text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between border-b border-[#ddd8c9] bg-[#eeece4] px-6 pt-4 pb-3.5 flex-wrap gap-3">
        <div className="flex items-center gap-3.5 flex-wrap">
          <div>
            <h1 className="font-[family-name:var(--font-manrope)] text-[21px] font-extrabold text-[#20201d]">My Timesheet</h1>
            <p className="text-[12.5px] text-[#726e60] mt-0.5">{fmtWeekRange(weekStart)}</p>
          </div>
          {/* Week nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              disabled={loadingWeek}
              className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#eae6da] transition-colors disabled:opacity-40"
              aria-label="Previous week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {!isCurrentWeek(weekStart) && (
              <button
                onClick={async () => {
                  // Jump back to current week
                  const d = new Date();
                  const dow = d.getDay();
                  const mon = new Date(d);
                  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
                  const curr = mon.toISOString().split("T")[0];
                  setLoadingWeek(true);
                  setWeekStart(curr);
                  const data = await getWeeklyTimesheetAction(slug, curr);
                  setWeekData(data);
                  setLoadingWeek(false);
                }}
                className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1 text-[11.5px] font-bold text-[#4a473e] hover:bg-[#eae6da] transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => navigateWeek(1)}
              disabled={loadingWeek}
              className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#eae6da] transition-colors disabled:opacity-40"
              aria-label="Next week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Total hours / target — matches prototype's two-stat display */}
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="font-[family-name:var(--font-manrope)] text-[20px] font-extrabold leading-none text-[#20201d]">
                {(weekData.totalMinutes / 60).toFixed(1)}h
              </div>
              <div className="text-[10.5px] text-[#a19d90]">logged this week</div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-manrope)] text-[20px] font-extrabold leading-none text-[#8c4632]">40h</div>
              <div className="text-[10.5px] text-[#a19d90]">target</div>
            </div>
          </div>

          {/* Premium: Submit Week */}
          {isPremium && weekData.totalMinutes > 0 && (
            submitStatus === "submitted" ? (
              <span className="rounded-[5px] px-4 py-2 text-[12.5px] font-semibold" style={{ background: "#e9f3ea", color: "#3f7d4c" }}>✓ Submitted</span>
            ) : (
              <button
                onClick={() => {
                  setSubmitStatus("idle");
                  startSubmit(async () => {
                    const res = await submitTimesheetAction(slug, weekStart, weekData.totalMinutes);
                    setSubmitStatus(res.ok ? "submitted" : "error");
                  });
                }}
                disabled={submitPending}
                className="rounded-[5px] px-4 py-2 text-[12.5px] font-bold text-[#f2e9d8] transition-colors disabled:opacity-50"
                style={{ background: "#8c4632", backgroundImage: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}
              >
                {submitPending ? "Submitting…" : "Submit week"}
              </button>
            )
          )}
          {/* Premium: Time Off */}
          {isPremium && (
            <button
              onClick={() => {
                setShowTimeOff(true);
                startPto(async () => {
                  const reqs = await getMyTimeOffRequestsAction(slug);
                  setPtoRequests(reqs);
                });
              }}
              className="flex items-center gap-1.5 rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-2 text-[12.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da] transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path strokeLinecap="round" d="M8 2v4M16 2v4M3 10h18" />
              </svg>
              Time Off
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-6 py-3.5">
        {loadingWeek ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-2 text-[12.5px] text-[#a19d90]">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          </div>
        ) : (
          <div className="fw-card overflow-hidden mb-4" style={{ minWidth: 820 }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e3ded0] bg-[#eae6da]">
                  {/* Issue column */}
                  <th className="w-[300px] px-3.5 py-[9px] text-left">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Issue</span>
                  </th>
                  {weekDates.map(date => {
                    const { day, num } = fmtDateHeader(date);
                    const isToday = date === today;
                    return (
                      <th
                        key={date}
                        className="px-3 py-[9px] text-center"
                        style={{ background: isToday ? "#eae6da" : undefined }}
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.06em]" style={{ color: isToday ? "#8c4632" : "#a19d90" }}>
                          {day} <span className="font-medium normal-case tracking-normal">{num.replace(/^[A-Za-z]+ /, "")}</span>
                        </span>
                      </th>
                    );
                  })}
                  <th className="w-[74px] px-3 py-[9px] text-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Total</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {weekData.entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="mx-auto max-w-xs">
                        <div className="text-4xl mb-3">⏱</div>
                        <p className="text-[13px] font-medium text-[#4a473e]">No time logged this week</p>
                        <p className="mt-1 text-[11.5px] text-[#a19d90]">Click a cell or use &ldquo;Log time&rdquo; to record work against issues.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedEntries.map((entry, rowIdx) => {
                    const rowTotal = entry.logs.reduce((s, l) => s + l.minutes, 0);
                    return (
                      <tr
                        key={entry.issueId}
                        className={rowIdx > 0 ? "border-t border-[#e3ded0]" : ""}
                      >
                        {/* Issue cell */}
                        <td className="px-3.5 py-2.5">
                          <Link
                            href={`/${slug}/issues/${entry.issueId}`}
                            className="block group"
                          >
                            <span className="font-mono text-[11px] font-bold text-[#a19d90] group-hover:text-[#8c4632]">
                              {entry.issueKey ?? "—"}
                            </span>
                            <span className="mt-0.5 block max-w-[11rem] truncate text-[12.5px] text-[#20201d]">
                              {entry.issueTitle}
                            </span>
                          </Link>
                        </td>

                        {/* Day cells */}
                        {weekDates.map(date => {
                          const mins = getDayMinutes(entry, date);
                          const log = getDayLog(entry, date);
                          const isToday = date === today;
                          return (
                            <td
                              key={date}
                              onClick={() => setLogModal({
                                issueId: entry.issueId,
                                issueTitle: entry.issueTitle,
                                issueKey: entry.issueKey,
                                date,
                                existingLog: log,
                              })}
                              className="px-3 py-2.5 text-center cursor-pointer transition-colors select-none hover:bg-[#eae6da]/60"
                              style={{ background: isToday ? "#eae6da" : undefined }}
                            >
                              <span className="text-[12.5px] font-medium" style={{ color: mins > 0 ? "#20201d" : "#c3bda9" }}>
                                {fmtMinutes(mins)}
                              </span>
                              {log?.billable && mins > 0 && (
                                <span className="ml-1 inline-block text-[9px] font-semibold rounded px-1" style={{ color: "#3f7d4c", background: "#e9f3ea" }}>$</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Row total */}
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-[12.5px] font-semibold" style={{ color: rowTotal > 0 ? "#20201d" : "#c3bda9" }}>
                            {fmtMinutes(rowTotal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Daily totals row */}
                {weekData.entries.length > 0 && (
                  <tr className="border-t border-[#e3ded0] bg-[#eae6da]">
                    <td className="px-3.5 py-2.5">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#726e60]">Daily total</span>
                    </td>
                    {weekDates.map(date => {
                      const total = getColTotal(date);
                      const isToday = date === today;
                      return (
                        <td key={date} className="px-3 py-2.5 text-center">
                          <span className="text-[12.5px] font-bold" style={{ color: isToday ? "#8c4632" : total > 0 ? "#20201d" : "#c3bda9" }}>
                            {fmtMinutes(total)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[13px] font-extrabold" style={{ color: weekData.totalMinutes > 0 ? "#8c4632" : "#c3bda9" }}>
                        {fmtMinutes(weekData.totalMinutes)}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Quick-add row */}
            <div className="border-t border-[#e3ded0] bg-[#eae6da]/50 px-3.5 py-2.5">
              <button
                onClick={() => setQuickAddOpen(true)}
                className="flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[11.5px] font-semibold text-[#726e60] hover:bg-[#eae6da] hover:text-[#20201d] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Log time
              </button>
            </div>

            {entryPageCount > 1 && (
              <div className="flex items-center justify-between border-t border-[#e3ded0] bg-[#f4f2eb] px-3.5 py-2 text-[11px] text-[#726e60]">
                <span>
                  {(currentEntryPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentEntryPage * ROWS_PER_PAGE, weekData.entries.length)} of {weekData.entries.length} issues
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEntryPage((p) => Math.max(1, p - 1))}
                    disabled={currentEntryPage === 1}
                    className="rounded-[5px] border border-[#ddd8c9] bg-white px-2 py-1 font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-40 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="px-1 font-semibold text-[#20201d]">Page {currentEntryPage} of {entryPageCount}</span>
                  <button
                    onClick={() => setEntryPage((p) => Math.min(entryPageCount, p + 1))}
                    disabled={currentEntryPage === entryPageCount}
                    className="rounded-[5px] border border-[#ddd8c9] bg-white px-2 py-1 font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state help text */}
        {weekData.entries.length === 0 && !loadingWeek && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-dashed border-[#c9791d] px-6 py-3 text-[12.5px] font-semibold text-[#8c4632] hover:bg-[#fdf1de]/40 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Log time on an issue
            </button>
          </div>
        )}

        {/* Time off — always-visible panel (not hidden behind a click) */}
        {isPremium && (
          <div className="fw-card mt-4 max-w-[460px] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-[family-name:var(--font-manrope)] text-[14px] font-extrabold text-[#20201d]">Time off</p>
            </div>
            {ptoRequests.length === 0 ? (
              <p className="text-[12px] text-[#a19d90]">No time off requested.</p>
            ) : (
              ptoRequests.map((r) => {
                const statusChip = r.status === "approved"
                  ? { fg: "#3f7d4c", bg: "#e9f3ea" }
                  : r.status === "rejected"
                    ? { fg: "#c0392b", bg: "#fbeae8" }
                    : { fg: "#c9791d", bg: "#fdf1de" };
                return (
                  <div key={r.id} className="flex items-center gap-3 border-t border-[#e3ded0] py-2 first:border-t-0">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize shrink-0" style={{ color: statusChip.fg, background: statusChip.bg }}>{r.status}</span>
                    <span className="flex-1 text-[12.5px] text-[#20201d] capitalize truncate">{r.type}</span>
                    <span className="text-[11px] text-[#a19d90] shrink-0">{r.daysCount} days</span>
                  </div>
                );
              })
            )}
            <button
              type="button"
              onClick={() => setShowTimeOff(true)}
              className="mt-3 text-[11.5px] font-bold text-[#b7452f] hover:underline"
            >
              + Request time off
            </button>
          </div>
        )}
      </div>

      {/* Recurring Entries */}
      <RecurringEntriesPanel slug={slug} />

      {/* Modals */}
      {logModal && (
        <LogTimeModal
          slug={slug}
          issueId={logModal.issueId}
          issueTitle={logModal.issueTitle}
          issueKey={logModal.issueKey}
          date={logModal.date}
          existingLog={logModal.existingLog}
          onClose={() => setLogModal(null)}
          onSuccess={handleLogSuccess}
        />
      )}

      {quickAddOpen && (
        <QuickAddModal
          slug={slug}
          weekDates={weekDates}
          existingIssues={weekData.entries}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={handleQuickAddSuccess}
        />
      )}

      {/* Time Off Modal */}
      {showTimeOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fw-card w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh]" style={{ background: "#f4f2eb" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-manrope)] text-[15px] font-extrabold text-[#20201d]">Time Off</h3>
              <button onClick={() => setShowTimeOff(false)} className="text-[#a19d90] hover:text-[#4a473e] text-xl">×</button>
            </div>

            {/* Request form */}
            <div className="rounded-[6px] border border-[#ddd8c9] p-4 space-y-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#726e60]">New Request</p>
              <div className="flex gap-2">
                {[["pto","PTO"],["sick","Sick"],["holiday","Holiday"],["other","Other"]].map(([v,l]) => (
                  <button
                    key={v}
                    onClick={() => setPtoType(v)}
                    className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
                      ptoType === v ? "bg-[#8c4632] text-[#f2e9d8] border-[#5e2c1f]" : "border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#eae6da]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-[#726e60] block mb-1">Start date</label>
                  <input type="date" value={ptoStart} onChange={(e) => setPtoStart(e.target.value)}
                    className="w-full rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#8c4632]/40" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-[#726e60] block mb-1">End date</label>
                  <input type="date" value={ptoEnd} onChange={(e) => setPtoEnd(e.target.value)} min={ptoStart}
                    className="w-full rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#8c4632]/40" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-[#726e60] block mb-1">Notes (optional)</label>
                <input value={ptoNotes} onChange={(e) => setPtoNotes(e.target.value)} placeholder="Optional context…"
                  className="w-full rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#8c4632]/40" />
              </div>
              {ptoError && <p className="text-[11.5px] text-[#c0392b]">{ptoError}</p>}
              <button
                disabled={!ptoStart || !ptoEnd || ptoPending}
                onClick={() => {
                  if (!ptoStart || !ptoEnd) return;
                  const days = Math.max(1, Math.round((new Date(ptoEnd).getTime() - new Date(ptoStart).getTime()) / 86400000) + 1);
                  setPtoError(null);
                  startPto(async () => {
                    const res = await requestTimeOffAction(slug, ptoType, ptoStart, ptoEnd, days, ptoNotes);
                    if (res.ok) {
                      setPtoStart(""); setPtoEnd(""); setPtoNotes("");
                      const reqs = await getMyTimeOffRequestsAction(slug);
                      setPtoRequests(reqs);
                    } else setPtoError(res.error ?? "Failed");
                  });
                }}
                className="rounded-[5px] px-4 py-1.5 text-[12.5px] font-semibold text-[#f2e9d8] disabled:opacity-50 transition-colors"
                style={{ background: "#8c4632", backgroundImage: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}
              >
                {ptoPending ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
