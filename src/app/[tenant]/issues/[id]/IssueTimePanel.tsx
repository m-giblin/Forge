"use client";

import { useState, useEffect, useTransition } from "react";
import {
  logTimeAction,
  deleteTimeLogAction,
  startIssueTimerAction,
  stopIssueTimerAction,
  updateTimeEstimateAction,
  type TimeLog,
} from "./timeActions";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtMinutes(m: number): string {
  if (m === 0) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function fmtElapsed(startedAt: string): string {
  const totalSecs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface IssueTimePanelProps {
  slug: string;
  issueId: string;
  initialLogs: TimeLog[];
  timeEstimateMinutes: number | null;
  initialTimerStartedAt: string | null;
  controlledTimerAt?: string | null;
  onTimerChange?: (at: string | null) => void;
  readOnly: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IssueTimePanel({
  slug,
  issueId,
  initialLogs,
  timeEstimateMinutes,
  initialTimerStartedAt,
  controlledTimerAt,
  onTimerChange,
  readOnly,
}: IssueTimePanelProps) {
  const [logs, setLogs] = useState<TimeLog[]>(initialLogs);
  const [localTimerAt, setLocalTimerAt] = useState<string | null>(initialTimerStartedAt);
  // Use controlled value when provided (shared with Activity header button)
  const timerStartedAt = controlledTimerAt !== undefined ? controlledTimerAt : localTimerAt;
  function setTimerStartedAt(v: string | null) {
    setLocalTimerAt(v);
    onTimerChange?.(v);
  }
  const [elapsed, setElapsed] = useState<string>(() =>
    initialTimerStartedAt ? fmtElapsed(initialTimerStartedAt) : "0s"
  );

  // Estimate editing
  const [estimate, setEstimate] = useState<number | null>(timeEstimateMinutes);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimateInput, setEstimateInput] = useState(
    timeEstimateMinutes != null ? String(Math.round(timeEstimateMinutes / 60 * 10) / 10) : ""
  );

  // Manual log form
  const [showForm, setShowForm] = useState(false);
  const [hoursInput, setHoursInput] = useState("");
  const [minutesInput, setMinutesInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [billable, setBillable] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [timerError, setTimerError] = useState<string | null>(null);

  // Live timer tick — only update inside the interval to satisfy no-direct-setState-in-effect
  useEffect(() => {
    if (!timerStartedAt) return;
    const id = setInterval(() => setElapsed(fmtElapsed(timerStartedAt)), 1000);
    return () => clearInterval(id);
  }, [timerStartedAt]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  const remainingMinutes = estimate != null ? estimate - totalMinutes : null;
  const pct = estimate && estimate > 0 ? Math.round((totalMinutes / estimate) * 100) : null;
  const barColor =
    pct == null ? "bg-indigo-400"
    : pct <= 80 ? "bg-emerald-500"
    : pct <= 110 ? "bg-amber-400"
    : "bg-red-500";

  // ── Handlers ─────────────────────────────────────────────────────────────

  function saveEstimate() {
    const hours = parseFloat(estimateInput);
    const mins = isNaN(hours) || hours <= 0 ? null : Math.round(hours * 60);
    setEditingEstimate(false);
    if (mins === estimate) return;
    setEstimate(mins);
    startTransition(async () => {
      await updateTimeEstimateAction(slug, issueId, mins);
    });
  }

  function startTimer() {
    setTimerError(null);
    startTransition(async () => {
      const res = await startIssueTimerAction(slug, issueId);
      if (res.ok && res.startedAt) {
        setTimerStartedAt(res.startedAt);
      } else {
        setTimerError(res.error ?? "Failed to start timer");
      }
    });
  }

  function stopTimer() {
    setTimerError(null);
    startTransition(async () => {
      const res = await stopIssueTimerAction(slug, issueId);
      if (res.ok) {
        setTimerStartedAt(null);
        setElapsed("0s");
        if (res.minutesLogged && res.minutesLogged > 0) {
          setLogs((prev) => [
            {
              id: crypto.randomUUID(),
              minutes: res.minutesLogged!,
              note: null,
              logged_at: new Date().toISOString(),
              user_name: "You",
            },
            ...prev,
          ]);
        }
      } else {
        setTimerError(res.error ?? "Failed to stop timer");
      }
    });
  }

  function submitLog() {
    const h = parseInt(hoursInput || "0", 10);
    const m = parseInt(minutesInput || "0", 10);
    const total = h * 60 + m;
    if (total <= 0) {
      setFormError("Enter at least 1 minute.");
      return;
    }
    setFormError(null);
    startTransition(async () => {
      try {
        await logTimeAction(slug, issueId, total, noteInput, billable, tagInput.trim() || null);
        setLogs((prev) => [
          {
            id: crypto.randomUUID(),
            minutes: total,
            note: noteInput.trim() || null,
            logged_at: new Date().toISOString(),
            user_name: "You",
          },
          ...prev,
        ]);
        setHoursInput("");
        setMinutesInput("");
        setNoteInput("");
        setBillable(false);
        setTagInput("");
        setShowForm(false);
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Failed to log time");
      }
    });
  }

  function removeLog(logId: string) {
    startTransition(async () => {
      await deleteTimeLogAction(slug, logId, issueId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">

      {/* ── Section 1: Estimate vs Actual ── */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          {/* Estimate */}
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500 mb-0.5">Estimate</p>
            {editingEstimate ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  autoFocus
                  value={estimateInput}
                  onChange={(e) => setEstimateInput(e.target.value)}
                  onBlur={saveEstimate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEstimate();
                    if (e.key === "Escape") setEditingEstimate(false);
                  }}
                  className="w-16 rounded border border-indigo-300 px-1.5 py-0.5 text-sm font-semibold text-neutral-900 outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-neutral-400">h</span>
              </div>
            ) : (
              <button
                onClick={() => !readOnly && setEditingEstimate(true)}
                className="group flex items-center gap-1"
                disabled={readOnly}
              >
                <span className="text-sm font-semibold text-neutral-800">
                  {estimate != null ? fmtMinutes(estimate) : "—"}
                </span>
                {!readOnly && (
                  <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors text-xs">✏</span>
                )}
              </button>
            )}
          </div>

          {/* Logged */}
          <div className="text-right">
            <p className="text-xs font-medium text-neutral-500 mb-0.5">Logged</p>
            <p className="text-sm font-semibold text-neutral-800">
              {totalMinutes > 0 ? fmtMinutes(totalMinutes) : "—"}
            </p>
          </div>

          {/* Remaining */}
          {estimate != null && (
            <div className="text-right">
              <p className="text-xs font-medium text-neutral-500 mb-0.5">Remaining</p>
              <p
                className={`text-sm font-semibold ${
                  remainingMinutes != null && remainingMinutes < 0
                    ? "text-red-600"
                    : "text-neutral-800"
                }`}
              >
                {remainingMinutes != null ? fmtMinutes(Math.abs(remainingMinutes)) + (remainingMinutes < 0 ? " over" : "") : "—"}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {estimate != null && estimate > 0 && (
          <div>
            <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 text-right">{pct}%</p>
          </div>
        )}
      </div>

      {/* ── Section 2: Live Timer ── */}
      {!readOnly && (
        <div className="p-4">
          {timerStartedAt ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Running</p>
                <p className="text-2xl font-bold tabular-nums text-neutral-900 tracking-tight">
                  {elapsed}
                </p>
              </div>
              <button
                onClick={stopTimer}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors shrink-0"
              >
                <span>⏹</span>
                <span>Stop &amp; Log</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-400">No active timer</p>
              <button
                onClick={startTimer}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
              >
                <span>▶</span>
                <span>Start Timer</span>
              </button>
            </div>
          )}
          {timerError && <p className="mt-1.5 text-xs text-red-600">{timerError}</p>}
        </div>
      )}

      {/* ── Section 3: Manual Log Form ── */}
      {!readOnly && (
        <div className="p-4">
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {showForm ? "− Hide manual log" : "+ Log time manually"}
          </button>

          {showForm && (
            <div className="mt-3 space-y-2">
              {/* Hours + Minutes */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={hoursInput}
                    onChange={(e) => setHoursInput(e.target.value)}
                    className="w-14 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs text-center outline-none focus:border-indigo-400"
                  />
                  <span className="text-xs text-neutral-400">hr</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    value={minutesInput}
                    onChange={(e) => setMinutesInput(e.target.value)}
                    className="w-14 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs text-center outline-none focus:border-indigo-400"
                  />
                  <span className="text-xs text-neutral-400">min</span>
                </div>
              </div>

              {/* Note */}
              <input
                type="text"
                placeholder="Note (optional)"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitLog()}
                className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
              />

              {/* Billable + Tag row */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billable}
                    onChange={(e) => setBillable(e.target.checked)}
                    className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  <span className="text-xs text-neutral-600">Billable</span>
                </label>
                <input
                  type="text"
                  placeholder="tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                />
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={submitLog}
                  disabled={isPending}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Log
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                  className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 4: Log History ── */}
      <div className="p-4">
        <p className="text-xs font-semibold text-neutral-500 mb-2">Time log</p>
        {logs.length === 0 ? (
          <p className="text-xs text-neutral-400">No time logged yet.</p>
        ) : (
          <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-0.5">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-2 text-xs">
                <span className="font-bold text-neutral-800 shrink-0 tabular-nums">
                  {fmtMinutes(l.minutes)}
                </span>
                <div className="flex-1 min-w-0">
                  {l.note ? (
                    <span className="text-neutral-700 truncate block">{l.note}</span>
                  ) : (
                    <span className="text-neutral-400 italic">no note</span>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-neutral-400">{relativeDate(l.logged_at)}</span>
                    {l.user_name && (
                      <span className="text-neutral-400">· {l.user_name}</span>
                    )}
                    {(l as TimeLog & { billable?: boolean }).billable && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                        billable
                      </span>
                    )}
                    {(l as TimeLog & { tag?: string | null }).tag && (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 border border-neutral-200">
                        {(l as TimeLog & { tag?: string | null }).tag}
                      </span>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeLog(l.id)}
                    disabled={isPending}
                    className="text-neutral-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                    aria-label="Delete log"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
