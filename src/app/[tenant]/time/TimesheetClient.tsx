"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getWeeklyTimesheetAction,
  getActiveTimerAction,
  stopTimerAction,
  logTimeFromSheetAction,
  deleteTimeLogFromSheetAction,
} from "./actions";

// ─── Types ──────────────────────────────────────────────────────────────────

type WeekData = Awaited<ReturnType<typeof getWeeklyTimesheetAction>>;
type ActiveTimer = Awaited<ReturnType<typeof getActiveTimerAction>>;

type LogEntry = WeekData["entries"][number]["logs"][number];
type IssueEntry = WeekData["entries"][number];

interface Props {
  slug: string;
  weekStart: string;
  initialWeekData: WeekData;
  activeTimer: ActiveTimer;
  isPremium: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMinutes(m: number): string {
  if (m <= 0) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split("T")[0];
}

function fmtDateHeader(dateStr: string): { day: string; num: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    day: d.toLocaleDateString("en-US", { weekday: "short" }),
    num: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function fmtWeekRange(weekStart: string): string {
  const dates = getWeekDates(weekStart);
  const start = new Date(dates[0] + "T00:00:00");
  const end = new Date(dates[6] + "T00:00:00");
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function isCurrentWeek(weekStart: string): boolean {
  const today = todayStr();
  const dates = getWeekDates(weekStart);
  return dates.includes(today);
}

function elapsedDisplay(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Log Time Modal ───────────────────────────────────────────────────────────

interface LogModalProps {
  slug: string;
  issueId: string;
  issueTitle: string;
  issueKey: string | null;
  date: string;
  existingLog?: LogEntry;
  onClose: () => void;
  onSuccess: (entry: { issueId: string; date: string; minutes: number; note: string | null; billable: boolean; id: string }) => void;
}

function LogTimeModal({ slug, issueId, issueTitle, issueKey, date, existingLog, onClose, onSuccess }: LogModalProps) {
  const [hours, setHours] = useState(existingLog ? Math.floor(existingLog.minutes / 60) : 0);
  const [minutes, setMinutes] = useState(existingLog ? existingLog.minutes % 60 : 30);
  const [note, setNote] = useState(existingLog?.note ?? "");
  const [billable, setBillable] = useState(existingLog?.billable ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalMins = hours * 60 + minutes;

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (totalMins <= 0) { setError("Enter at least 1 minute."); return; }
    setSaving(true);
    setError(null);
    const res = await logTimeFromSheetAction(slug, issueId, date, totalMins, note, billable);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Failed to save."); return; }
    onSuccess({ issueId, date, minutes: totalMins, note: note.trim() || null, billable, id: crypto.randomUUID() });
    onClose();
  }

  async function handleDelete() {
    if (!existingLog) return;
    setDeleting(true);
    await deleteTimeLogFromSheetAction(slug, existingLog.id);
    onSuccess({ issueId, date, minutes: 0, note: null, billable: false, id: existingLog.id });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-neutral-200" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">Log time</p>
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {issueKey && <span className="text-indigo-600 mr-1.5">{issueKey}</span>}
            {issueTitle}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">{displayDate}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Time inputs */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-2">Time logged</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={e => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-16 rounded-lg border border-neutral-200 px-3 py-2 text-center text-sm font-medium text-neutral-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="text-xs text-neutral-500">h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  className="w-16 rounded-lg border border-neutral-200 px-3 py-2 text-center text-sm font-medium text-neutral-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="text-xs text-neutral-500">m</span>
              </div>
              <span className="ml-auto text-xs text-neutral-400">
                {totalMins > 0 ? fmtMinutes(totalMins) : "—"}
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Note <span className="text-neutral-400 font-normal">(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="What did you work on?"
              className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Billable */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={billable}
              onChange={e => setBillable(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-neutral-700">Billable</span>
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div>
              {existingLog && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete entry"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || totalMins <= 0}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : existingLog ? "Update" : "Log time"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quick-add Modal ──────────────────────────────────────────────────────────

interface QuickAddModalProps {
  slug: string;
  weekDates: string[];
  existingIssues: IssueEntry[];
  onClose: () => void;
  onSuccess: (entry: { issueId: string; issueKey: string | null; issueTitle: string; projectName: string | null; date: string; minutes: number; note: string | null; billable: boolean; id: string }) => void;
}

function QuickAddModal({ slug, weekDates, existingIssues, onClose, onSuccess }: QuickAddModalProps) {
  const today = todayStr();
  const defaultDate = weekDates.includes(today) ? today : weekDates[0];

  const [issueKey, setIssueKey] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search among existing week issues
  const filteredIssues = issueKey.trim()
    ? existingIssues.filter(
        e =>
          (e.issueKey ?? "").toLowerCase().includes(issueKey.toLowerCase()) ||
          e.issueTitle.toLowerCase().includes(issueKey.toLowerCase()),
      )
    : [];

  const [selectedIssue, setSelectedIssue] = useState<IssueEntry | null>(null);
  const totalMins = hours * 60 + minutes;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIssue && !issueKey.trim()) { setError("Enter an issue key or select an issue."); return; }
    if (totalMins <= 0) { setError("Enter at least 1 minute."); return; }

    setSaving(true);
    setError(null);

    const target = selectedIssue ?? existingIssues.find(
      e => (e.issueKey ?? "").toLowerCase() === issueKey.toLowerCase().trim(),
    );

    if (!target) { setError("Issue not found. Search for it or enter a valid key from this week."); setSaving(false); return; }

    const res = await logTimeFromSheetAction(slug, target.issueId, date, totalMins, note, billable);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Failed to save."); return; }

    onSuccess({
      issueId: target.issueId,
      issueKey: target.issueKey,
      issueTitle: target.issueTitle,
      projectName: target.projectName,
      date,
      minutes: totalMins,
      note: note.trim() || null,
      billable,
      id: crypto.randomUUID(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-neutral-200" onClick={e => e.stopPropagation()}>
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-sm font-semibold text-neutral-900">Log time</p>
          <p className="text-xs text-neutral-500 mt-0.5">Add a time entry for any issue</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Issue picker */}
          <div className="relative">
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Issue</label>
            <input
              type="text"
              value={selectedIssue ? `${selectedIssue.issueKey ?? ""} – ${selectedIssue.issueTitle}` : issueKey}
              onChange={e => { setIssueKey(e.target.value); setSelectedIssue(null); }}
              placeholder="Search by key or title…"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {filteredIssues.length > 0 && !selectedIssue && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
                {filteredIssues.map(issue => (
                  <button
                    key={issue.issueId}
                    type="button"
                    onClick={() => { setSelectedIssue(issue); setIssueKey(""); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-indigo-600 shrink-0">{issue.issueKey ?? "–"}</span>
                    <span className="truncate text-sm text-neutral-700">{issue.issueTitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Date</label>
            <select
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {weekDates.map(d => (
                <option key={d} value={d}>
                  {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </option>
              ))}
            </select>
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-2">Time</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={e => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-16 rounded-lg border border-neutral-200 px-3 py-2 text-center text-sm font-medium focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="text-xs text-neutral-500">h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  className="w-16 rounded-lg border border-neutral-200 px-3 py-2 text-center text-sm font-medium focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <span className="text-xs text-neutral-500">m</span>
              </div>
              <span className="ml-auto text-xs text-neutral-400">{totalMins > 0 ? fmtMinutes(totalMins) : "—"}</span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Note <span className="text-neutral-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What did you work on?"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Billable */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={billable}
              onChange={e => setBillable(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-neutral-700">Billable</span>
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || totalMins <= 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Log time"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function TimesheetClient({ slug, weekStart: initialWeekStart, initialWeekData, activeTimer: initialActiveTimer, isPremium }: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [weekData, setWeekData] = useState<WeekData>(initialWeekData);
  const [activeTimer, setActiveTimer] = useState(initialActiveTimer);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [stoppingTimer, setStoppingTimer] = useState(false);
  const [elapsed, setElapsed] = useState("");

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
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              Submit week
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
    </div>
  );
}
