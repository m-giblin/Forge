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
    const data = await getWeeklyTimesheetAction(slug, newStart);
    setWeekData(data);
    setLoadingWeek(false);
  }, [weekStart, slug]);

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
    <div className="flex flex-col min-h-screen bg-neutral-50">

      {/* Active Timer Banner */}
      {activeTimer && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5">
          <span className="text-base">⏱</span>
          <span className="text-sm text-amber-800">
            <span className="font-semibold">Timer running</span>
            {activeTimer.issueKey && (
              <> on <Link href={`/${slug}/issues/${activeTimer.issueId}`} className="font-bold text-amber-900 hover:underline">{activeTimer.issueKey}</Link>:</>
            )}
            {activeTimer.issueName && <> {activeTimer.issueName}</>}
          </span>
          <span className="ml-1 font-mono text-sm font-semibold text-amber-700 tabular-nums">{elapsed}</span>
          <div className="ml-auto">
            <button
              onClick={handleStopTimer}
              disabled={stoppingTimer}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {stoppingTimer ? "Stopping…" : "Stop"}
            </button>
          </div>
        </div>
      )}

      {showReminderBanner && (
        <div className="flex items-center gap-3 border-b border-indigo-200 bg-indigo-50 px-6 py-2.5">
          <span className="text-base">📋</span>
          <span className="flex-1 text-sm text-indigo-800">
            You haven&apos;t logged any time this week. Start tracking ↓
          </span>
          <button
            onClick={() => setReminderDismissed(true)}
            className="ml-auto text-indigo-400 hover:text-indigo-600 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">My Timesheet</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{fmtWeekRange(weekStart)}</p>
          </div>
          {/* Week nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              disabled={loadingWeek}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-40"
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
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => navigateWeek(1)}
              disabled={loadingWeek}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-40"
              aria-label="Next week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Total hours badge */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${weekData.totalMinutes > 0 ? "bg-indigo-50 text-indigo-700" : "bg-neutral-100 text-neutral-500"}`}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            {weekData.totalMinutes > 0 ? `${(weekData.totalMinutes / 60).toFixed(1)}h this week` : "No time logged"}
          </div>

          {/* Premium: Submit Week */}
          {isPremium && weekData.totalMinutes > 0 && (
            submitStatus === "submitted" ? (
              <span className="rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700">✓ Submitted</span>
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
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              🏖 Time Off
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {loadingWeek ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {/* Issue column */}
                  <th className="w-52 border-r border-neutral-200 px-4 py-3 text-left">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Issue</span>
                  </th>
                  {weekDates.map(date => {
                    const { day, num } = fmtDateHeader(date);
                    const isToday = date === today;
                    return (
                      <th
                        key={date}
                        className={`border-r border-neutral-200 px-3 py-3 text-center last:border-r-0 ${isToday ? "bg-indigo-50" : ""}`}
                      >
                        <div className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-indigo-600" : "text-neutral-400"}`}>{day}</div>
                        <div className={`mt-0.5 text-[11px] font-medium ${isToday ? "text-indigo-500" : "text-neutral-400"}`}>{num}</div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-center">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Total</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {weekData.entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="mx-auto max-w-xs">
                        <div className="text-4xl mb-3">⏱</div>
                        <p className="text-sm font-medium text-neutral-600">No time logged this week</p>
                        <p className="mt-1 text-xs text-neutral-400">Click a cell or use &ldquo;Log time&rdquo; to record work against issues.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  weekData.entries.map((entry, rowIdx) => {
                    const rowTotal = entry.logs.reduce((s, l) => s + l.minutes, 0);
                    return (
                      <tr
                        key={entry.issueId}
                        className={`border-b border-neutral-100 transition-colors hover:bg-neutral-50/60 ${rowIdx % 2 === 1 ? "bg-neutral-50/40" : ""}`}
                      >
                        {/* Issue cell */}
                        <td className="border-r border-neutral-200 px-4 py-2.5">
                          <Link
                            href={`/${slug}/issues/${entry.issueId}`}
                            className="block group"
                          >
                            <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                              {entry.issueKey ?? "—"}
                            </span>
                            <span className="mt-0.5 block max-w-[11rem] truncate text-xs text-neutral-500 group-hover:text-neutral-700">
                              {entry.issueTitle}
                            </span>
                            {entry.projectName && (
                              <span className="mt-0.5 block text-[10px] text-neutral-400">{entry.projectName}</span>
                            )}
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
                              className={`border-r border-neutral-100 px-3 py-2.5 text-center cursor-pointer transition-colors last:border-r-0 select-none
                                ${isToday ? "bg-indigo-50/40 hover:bg-indigo-100/60" : "hover:bg-indigo-50"}`}
                            >
                              <span className={`text-xs font-medium ${mins > 0 ? "text-neutral-900" : "text-neutral-300"}`}>
                                {fmtMinutes(mins)}
                              </span>
                              {log?.billable && mins > 0 && (
                                <span className="ml-1 inline-block text-[9px] font-semibold text-green-600 bg-green-50 rounded px-1">$</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Row total */}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-semibold ${rowTotal > 0 ? "text-neutral-800" : "text-neutral-300"}`}>
                            {fmtMinutes(rowTotal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Daily totals row */}
                {weekData.entries.length > 0 && (
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50">
                    <td className="border-r border-neutral-200 px-4 py-2.5">
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Daily total</span>
                    </td>
                    {weekDates.map(date => {
                      const total = getColTotal(date);
                      const isToday = date === today;
                      return (
                        <td key={date} className={`border-r border-neutral-200 px-3 py-2.5 text-center last:border-r-0 ${isToday ? "bg-indigo-50/60" : ""}`}>
                          <span className={`text-xs font-bold ${total > 0 ? "text-neutral-800" : "text-neutral-300"}`}>
                            {fmtMinutes(total)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-bold ${weekData.totalMinutes > 0 ? "text-indigo-700" : "text-neutral-300"}`}>
                        {fmtMinutes(weekData.totalMinutes)}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Quick-add row */}
            <div className="border-t border-neutral-200 bg-neutral-50/50 px-4 py-2.5">
              <button
                onClick={() => setQuickAddOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Log time
              </button>
            </div>
          </div>
        )}

        {/* Empty state help text */}
        {weekData.entries.length === 0 && !loadingWeek && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 px-6 py-3 text-sm font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/60 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Log time on an issue
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-900">🏖 Time Off</h3>
              <button onClick={() => setShowTimeOff(false)} className="text-neutral-400 hover:text-neutral-600 text-xl">×</button>
            </div>

            {/* Request form */}
            <div className="rounded-xl border border-neutral-200 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">New Request</p>
              <div className="flex gap-2">
                {[["pto","PTO"],["sick","Sick"],["holiday","Holiday"],["other","Other"]].map(([v,l]) => (
                  <button
                    key={v}
                    onClick={() => setPtoType(v)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      ptoType === v ? "bg-indigo-600 text-white border-indigo-600" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-neutral-500 block mb-1">Start date</label>
                  <input type="date" value={ptoStart} onChange={(e) => setPtoStart(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-neutral-500 block mb-1">End date</label>
                  <input type="date" value={ptoEnd} onChange={(e) => setPtoEnd(e.target.value)} min={ptoStart}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Notes (optional)</label>
                <input value={ptoNotes} onChange={(e) => setPtoNotes(e.target.value)} placeholder="Optional context…"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              {ptoError && <p className="text-xs text-red-600">{ptoError}</p>}
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
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {ptoPending ? "Submitting…" : "Submit Request"}
              </button>
            </div>

            {/* Past requests */}
            {ptoRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">My Requests</p>
                {ptoRequests.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 capitalize">{r.type}</p>
                      <p className="text-xs text-neutral-500">{r.startDate} → {r.endDate} · {r.daysCount} days</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      r.status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                    }`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
