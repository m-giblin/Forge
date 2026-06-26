"use client";

import { useState, useTransition } from "react";
import { logTimeAction, deleteTimeLogAction, type TimeLog } from "./timeActions";

function fmtMinutes(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export default function TimeTracker({
  slug,
  issueId,
  initialLogs,
  readOnly,
}: {
  slug: string;
  issueId: string;
  initialLogs: TimeLog[];
  readOnly: boolean;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [hoursInput, setHoursInput] = useState("");
  const [minutesInput, setMinutesInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalMinutes = logs.reduce((s, l) => s + l.minutes, 0);

  function submit() {
    const h = parseInt(hoursInput || "0", 10);
    const m = parseInt(minutesInput || "0", 10);
    const total = h * 60 + m;
    if (total <= 0) { setError("Enter at least 1 minute."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await logTimeAction(slug, issueId, total, noteInput);
        setLogs((prev) => [
          { id: crypto.randomUUID(), minutes: total, note: noteInput.trim() || null, logged_at: new Date().toISOString(), user_name: "You" },
          ...prev,
        ]);
        setHoursInput(""); setMinutesInput(""); setNoteInput(""); setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to log time");
      }
    });
  }

  function remove(logId: string) {
    startTransition(async () => {
      await deleteTimeLogAction(slug, logId, issueId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-neutral-600">Time Logged</p>
          <p className="text-lg font-bold text-neutral-900 mt-0.5">
            {totalMinutes > 0 ? fmtMinutes(totalMinutes) : "—"}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
          >
            + Log time
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" placeholder="0h"
                value={hoursInput} onChange={(e) => setHoursInput(e.target.value)}
                className="w-14 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs text-center outline-none focus:border-indigo-400"
              />
              <span className="text-xs text-neutral-400">hr</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="59" placeholder="0m"
                value={minutesInput} onChange={(e) => setMinutesInput(e.target.value)}
                className="w-14 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs text-center outline-none focus:border-indigo-400"
              />
              <span className="text-xs text-neutral-400">min</span>
            </div>
          </div>
          <input
            type="text" placeholder="Note (optional)"
            value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit} disabled={isPending}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Log
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto">
          {logs.map((l) => (
            <li key={l.id} className="flex items-start gap-2 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-800 shrink-0">{fmtMinutes(l.minutes)}</span>
              <span className="flex-1 truncate">{l.note ?? <span className="text-neutral-400">no note</span>}</span>
              <span className="text-neutral-400 shrink-0">{l.user_name ?? "—"}</span>
              {!readOnly && (
                <button onClick={() => remove(l.id)} disabled={isPending} className="text-neutral-300 hover:text-red-500 shrink-0">✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
