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
  activityStopLog?: { minutes: number; note: string } | null;
  onActivityStopConsumed?: () => void;
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
  activityStopLog,
  onActivityStopConsumed,
  readOnly,
}: IssueTimePanelProps) {
  const [logs, setLogs] = useState<TimeLog[]>(initialLogs);

  // When Activity-header Stop Timer fires, IssueDetail passes the logged entry here
  // so we can optimistically update without waiting for a full RSC refresh.
  useEffect(() => {
    if (!activityStopLog) return;
    setLogs((prev) => [
      {
        id: crypto.randomUUID(),
        minutes: activityStopLog.minutes,
        note: activityStopLog.note || null,
        logged_at: new Date().toISOString(),
        user_name: "You",
      },
      ...prev,
    ]);
    onActivityStopConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityStopLog]);
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
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(`forge-time-alerts-${issueId}`);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });

  function dismissAlert(key: string) {
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem(`forge-time-alerts-${issueId}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

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
    pct == null ? "bg-[#b7452f]"
    : pct <= 80 ? "bg-[#3f7d4c]"
    : pct <= 110 ? "bg-[#c9791d]"
    : "bg-[#c0392b]";

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
              note: res.note ?? null,
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
    <div className="rounded-xl border border-[#ddd8c9] bg-white divide-y divide-[#ddd8c9]">

      {/* ── Section 1: Estimate vs Actual ── */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          {/* Estimate */}
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#726e60] mb-0.5">Estimate</p>
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
                  className="w-16 rounded border border-[#b7452f] px-1.5 py-0.5 text-sm font-semibold text-[#20201d] outline-none focus:border-[#8c4632]"
                />
                <span className="text-xs text-[#a19d90]">h</span>
              </div>
            ) : (
              <button
                onClick={() => !readOnly && setEditingEstimate(true)}
                className="group flex items-center gap-1"
                disabled={readOnly}
              >
                <span className="text-sm font-semibold text-[#20201d]">
                  {estimate != null ? fmtMinutes(estimate) : "—"}
                </span>
                {!readOnly && (
                  <span className="text-[#a19d90] group-hover:text-[#726e60] transition-colors text-xs">✏</span>
                )}
              </button>
            )}
          </div>

          {/* Logged */}
          <div className="text-right">
            <p className="text-xs font-medium text-[#726e60] mb-0.5">Logged</p>
            <p className="text-sm font-semibold text-[#20201d]">
              {totalMinutes > 0 ? fmtMinutes(totalMinutes) : "—"}
            </p>
          </div>

          {/* Remaining */}
          {estimate != null && (
            <div className="text-right">
              <p className="text-xs font-medium text-[#726e60] mb-0.5">Remaining</p>
              <p
                className={`text-sm font-semibold ${
                  remainingMinutes != null && remainingMinutes < 0
                    ? "text-[#c0392b]"
                    : "text-[#20201d]"
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
            <div className="h-1.5 rounded-full bg-[#f4f2eb] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-[#a19d90] mt-0.5 text-right">{pct}%</p>
          </div>
        )}
      </div>

      {/* ── Budget Alert Banners ── */}
      {estimate != null && estimate > 0 && pct != null && pct >= 90 && pct < 100 && !dismissedAlerts.has(`warn-${issueId}`) && (
        <div className="mx-4 mb-0 mt-0 flex items-start justify-between gap-2 rounded-lg border border-[#f1d9ae] bg-[#fdf1de] px-3 py-2">
          <p className="text-xs text-[#c9791d]">⚠ Approaching estimate — {pct}% used</p>
          <button onClick={() => dismissAlert(`warn-${issueId}`)} className="text-[#c9791d] hover:text-[#a3630f] text-xs shrink-0">✕</button>
        </div>
      )}
      {estimate != null && estimate > 0 && pct != null && pct >= 100 && !dismissedAlerts.has(`over-${issueId}`) && (
        <div className="mx-4 mb-0 mt-0 flex items-start justify-between gap-2 rounded-lg border border-[#f0c3bd] bg-[#fbeae8] px-3 py-2">
          <p className="text-xs text-[#c0392b]">⚠ Over estimate by {fmtMinutes(totalMinutes - estimate)} — consider updating the estimate or flagging scope creep</p>
          <button onClick={() => dismissAlert(`over-${issueId}`)} className="text-[#c0392b] hover:text-[#a3291b] text-xs shrink-0">✕</button>
        </div>
      )}

      {/* ── Section 2: Live Timer ── */}
      {!readOnly && (
        <div className="p-4">
          {timerStartedAt ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#726e60] mb-0.5">Running</p>
                <p className="text-2xl font-bold tabular-nums text-[#20201d] tracking-tight">
                  {elapsed}
                </p>
              </div>
              <button
                onClick={stopTimer}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#c0392b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a3291b] disabled:opacity-50 transition-colors shrink-0"
              >
                <span>⏹</span>
                <span>Stop &amp; Log</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[#a19d90]">No active timer</p>
              <button
                onClick={startTimer}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#b7452f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8c4632] disabled:opacity-50 transition-colors shrink-0"
              >
                <span>▶</span>
                <span>Start Timer</span>
              </button>
            </div>
          )}
          {timerError && <p className="mt-1.5 text-xs text-[#c0392b]">{timerError}</p>}
        </div>
      )}

      {/* ── Section 3: Manual Log Form ── */}
      {!readOnly && (
        <div className="p-4">
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-xs font-medium text-[#b7452f] hover:text-[#8c4632] transition-colors"
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
                    className="w-14 rounded-lg border border-[#ddd8c9] px-2 py-1.5 text-xs text-center outline-none focus:border-[#b7452f]"
                  />
                  <span className="text-xs text-[#a19d90]">hr</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    value={minutesInput}
                    onChange={(e) => setMinutesInput(e.target.value)}
                    className="w-14 rounded-lg border border-[#ddd8c9] px-2 py-1.5 text-xs text-center outline-none focus:border-[#b7452f]"
                  />
                  <span className="text-xs text-[#a19d90]">min</span>
                </div>
              </div>

              {/* Note */}
              <input
                type="text"
                placeholder="Note (optional)"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitLog()}
                className="w-full rounded-lg border border-[#ddd8c9] px-2 py-1.5 text-xs outline-none focus:border-[#b7452f]"
              />

              {/* Tag chips */}
              <div className="space-y-1.5">
                <p className="text-xs text-[#726e60]">Tag</p>
                <div className="flex flex-wrap gap-1">
                  {["Development","Review","Meetings","Testing","Design","Planning","Support"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTagInput(tagInput === t ? "" : t)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors ${
                        tagInput === t
                          ? "bg-[#b7452f] text-white border-[#b7452f]"
                          : "bg-[#f4f2eb] text-[#4a473e] border-[#ddd8c9] hover:border-[#a19d90]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="or type custom tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full rounded-lg border border-[#ddd8c9] px-2 py-1 text-xs outline-none focus:border-[#b7452f]"
                />
              </div>

              {/* Billable */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={billable}
                  onChange={(e) => setBillable(e.target.checked)}
                  className="rounded border-[#ddd8c9] text-[#b7452f] focus:ring-[#b7452f]"
                />
                <span className="text-xs text-[#4a473e]">Billable</span>
              </label>

              {formError && <p className="text-xs text-[#c0392b]">{formError}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={submitLog}
                  disabled={isPending}
                  className="rounded-lg bg-[#b7452f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8c4632] disabled:opacity-50 transition-colors"
                >
                  Log
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                  className="text-xs text-[#a19d90] hover:text-[#4a473e] transition-colors"
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
        <p className="text-xs font-semibold text-[#726e60] mb-2">Time log</p>
        {logs.length === 0 ? (
          <p className="text-xs text-[#a19d90]">No time logged yet.</p>
        ) : (
          <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-0.5">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-2 text-xs">
                <span className="font-bold text-[#20201d] shrink-0 tabular-nums">
                  {fmtMinutes(l.minutes)}
                </span>
                <div className="flex-1 min-w-0">
                  {l.note ? (
                    <span className="text-[#4a473e] truncate block">{l.note}</span>
                  ) : (
                    <span className="text-[#a19d90] italic">no note</span>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[#a19d90]">{relativeDate(l.logged_at)}</span>
                    {l.user_name && (
                      <span className="text-[#a19d90]">· {l.user_name}</span>
                    )}
                    {(l as TimeLog & { billable?: boolean }).billable && (
                      <span className="inline-flex items-center rounded-full bg-[#e9f3ea] px-1.5 py-0.5 text-[10px] font-medium text-[#3f7d4c] border border-[#c7e0cb]">
                        billable
                      </span>
                    )}
                    {(l as TimeLog & { tag?: string | null }).tag && (
                      <span className="inline-flex items-center rounded-full bg-[#f4f2eb] px-1.5 py-0.5 text-[10px] font-medium text-[#4a473e] border border-[#ddd8c9]">
                        {(l as TimeLog & { tag?: string | null }).tag}
                      </span>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeLog(l.id)}
                    disabled={isPending}
                    className="text-[#a19d90] hover:text-[#c0392b] transition-colors shrink-0 mt-0.5"
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
