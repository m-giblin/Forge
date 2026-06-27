"use client";

import { useState, useTransition } from "react";
import type { TimesheetRow } from "./actions";
import { getAdminTimesheetsAction, reviewTimesheetAction } from "./actions";

function fmtHours(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  draft: "bg-neutral-100 text-neutral-500",
};

function ReviewModal({ sheet, slug, onDone }: { sheet: TimesheetRow; slug: string; onDone: () => void }) {
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(action: "approved" | "rejected") {
    setError(null);
    start(async () => {
      const res = await reviewTimesheetAction(slug, sheet.id, action, notes);
      if (res.ok) onDone();
      else setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-semibold text-neutral-900">Review Timesheet</h3>
        <div className="text-sm text-neutral-600 space-y-1">
          <p><span className="font-medium">{sheet.userName}</span> · Week of {fmtDate(sheet.weekStart)}</p>
          <p>{fmtHours(sheet.totalMinutes)} logged</p>
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 block mb-1">Notes (optional)</label>
          <textarea
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            rows={3}
            placeholder="Feedback for the team member…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onDone} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
            Cancel
          </button>
          <button
            onClick={() => submit("rejected")}
            disabled={pending}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => submit("approved")}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TimesheetsClient({ slug, initial }: { slug: string; initial: TimesheetRow[] }) {
  const [sheets, setSheets] = useState(initial);
  const [weekFilter, setWeekFilter] = useState("");
  const [reviewing, setReviewing] = useState<TimesheetRow | null>(null);
  const [loading, startLoad] = useTransition();

  function applyFilter() {
    startLoad(async () => {
      const data = await getAdminTimesheetsAction(slug, weekFilter || undefined);
      setSheets(data);
    });
  }

  const pending = sheets.filter((s) => s.status === "submitted");
  const reviewed = sheets.filter((s) => s.status !== "submitted");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-neutral-900 flex-1">Timesheet Approvals</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={applyFilter}
            disabled={loading}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Filter
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
            Awaiting Review ({pending.length})
          </h2>
          <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
            {pending.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{s.userName}</p>
                  <p className="text-xs text-neutral-500">Week of {fmtDate(s.weekStart)} · {fmtHours(s.totalMinutes)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[s.status]}`}>
                  {s.status}
                </span>
                <button
                  onClick={() => setReviewing(s)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Reviewed</h2>
          <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
            {reviewed.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{s.userName}</p>
                  <p className="text-xs text-neutral-500">Week of {fmtDate(s.weekStart)} · {fmtHours(s.totalMinutes)}</p>
                  {s.reviewerNotes && <p className="text-xs text-neutral-400 mt-0.5 truncate">&ldquo;{s.reviewerNotes}&rdquo;</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[s.status]}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sheets.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
          <p className="text-sm font-medium text-neutral-500">No timesheets submitted yet</p>
          <p className="text-xs text-neutral-400 mt-1">Team members submit their weekly time from the My Time page.</p>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          sheet={reviewing}
          slug={slug}
          onDone={() => {
            setReviewing(null);
            startLoad(async () => {
              const data = await getAdminTimesheetsAction(slug, weekFilter || undefined);
              setSheets(data);
            });
          }}
        />
      )}
    </div>
  );
}
