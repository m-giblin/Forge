"use client";

import { useState } from "react";
import { logTimeFromSheetAction } from "./actions";
import { fmtMinutes, todayStr, TagSelector, type IssueEntry } from "./timeHelpers";

interface QuickAddModalProps {
  slug: string;
  weekDates: string[];
  existingIssues: IssueEntry[];
  onClose: () => void;
  onSuccess: (entry: { issueId: string; issueKey: string | null; issueTitle: string; projectName: string | null; date: string; minutes: number; note: string | null; billable: boolean; id: string }) => void;
}

export default function QuickAddModal({ slug, weekDates, existingIssues, onClose, onSuccess }: QuickAddModalProps) {
  const today = todayStr();
  const defaultDate = weekDates.includes(today) ? today : weekDates[0];

  const [issueKey, setIssueKey] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [billable, setBillable] = useState(false);
  const [tag, setTag] = useState("");
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

    const res = await logTimeFromSheetAction(slug, target.issueId, date, totalMins, note, billable, tag.trim() || null);
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
