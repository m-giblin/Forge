"use client";

import { useState } from "react";
import { logTimeFromSheetAction, deleteTimeLogFromSheetAction } from "./actions";
import { fmtMinutes, TagSelector, type LogEntry } from "./timeHelpers";

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

export default function LogTimeModal({ slug, issueId, issueTitle, issueKey, date, existingLog, onClose, onSuccess }: LogModalProps) {
  const [hours, setHours] = useState(existingLog ? Math.floor(existingLog.minutes / 60) : 0);
  const [minutes, setMinutes] = useState(existingLog ? existingLog.minutes % 60 : 30);
  const [note, setNote] = useState(existingLog?.note ?? "");
  const [billable, setBillable] = useState(existingLog?.billable ?? false);
  const [tag, setTag] = useState("");
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
    const res = await logTimeFromSheetAction(slug, issueId, date, totalMins, note, billable, tag.trim() || null);
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

          <TagSelector value={tag} onChange={setTag} />

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
