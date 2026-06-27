"use client";

import { useState, useTransition } from "react";
import type { TimesheetRow } from "./actions";
import { getAdminTimesheetsAction, reviewTimesheetAction } from "./actions";

function fmtHours(m: number) {
  if (m <= 0) return "0h";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getCurrentWeekStart(): string {
  const d = new Date();
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return mon.toISOString().split("T")[0];
}

function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split("T")[0];
}

function fmtWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  draft: "bg-neutral-100 text-neutral-500",
};

export default function TimesheetsClient({ slug, initial }: { slug: string; initial: TimesheetRow[] }) {
  const [allSheets, setAllSheets] = useState(initial);
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);
  const [loading, startLoad] = useTransition();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);
  const [actionPending, startAction] = useTransition();

  function loadWeek(ws: string) {
    setWeekStart(ws);
    startLoad(async () => {
      const data = await getAdminTimesheetsAction(slug, ws);
      setAllSheets(data);
    });
  }

  const sheets = allSheets.filter((s) => s.weekStart === weekStart);

  const submitted = sheets.filter((s) => s.status === "submitted");
  const approved = sheets.filter((s) => s.status === "approved");
  const rejected = sheets.filter((s) => s.status === "rejected");
  const totalTeamHours = approved.reduce((sum, s) => sum + s.totalMinutes, 0) +
    submitted.reduce((sum, s) => sum + s.totalMinutes, 0);

  function review(id: string, action: "approved" | "rejected") {
    const notes = rejectNotes[id] ?? "";
    startAction(async () => {
      await reviewTimesheetAction(slug, id, action, notes);
      setShowRejectFor(null);
      setReviewingId(null);
      const data = await getAdminTimesheetsAction(slug, weekStart);
      setAllSheets(data);
    });
  }

  const isCurrentWeek = weekStart === getCurrentWeekStart();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-neutral-900 flex-1">Timesheet Approvals</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadWeek(addWeeks(weekStart, -1))}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
            aria-label="Previous week"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="px-3 text-sm font-medium text-neutral-700 min-w-[200px] text-center">
            {fmtWeekLabel(weekStart)}
          </span>
          <button
            onClick={() => loadWeek(addWeeks(weekStart, 1))}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40"
            aria-label="Next week"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => loadWeek(getCurrentWeekStart())}
              className="ml-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Current week
            </button>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Submitted", value: submitted.length, color: "text-amber-700 bg-amber-50" },
          { label: "Approved", value: approved.length, color: "text-emerald-700 bg-emerald-50" },
          { label: "Rejected", value: rejected.length, color: "text-red-600 bg-red-50" },
          { label: "Team hours", value: fmtHours(totalTeamHours), color: "text-indigo-700 bg-indigo-50" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl px-4 py-3 ${stat.color}`}>
            <p className="text-xs font-medium opacity-70">{stat.label}</p>
            <p className="text-xl font-bold mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {sheets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
          <p className="text-sm font-medium text-neutral-500">No submitted timesheets for this week</p>
          <p className="text-xs text-neutral-400 mt-1">Team members submit their weekly time from the My Time page.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Member</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Week</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Hours</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sheets.map((s) => (
                <>
                  <tr key={s.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                          {getInitials(s.userName)}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{s.userName}</p>
                          <p className="text-[10px] text-neutral-400">{s.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{fmtDate(s.weekStart)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-800">{fmtHours(s.totalMinutes)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[s.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === "submitted" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setShowRejectFor(showRejectFor === s.id ? null : s.id)}
                            disabled={actionPending}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => { setReviewingId(s.id); review(s.id, "approved"); }}
                            disabled={actionPending || reviewingId === s.id}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {reviewingId === s.id && actionPending ? "…" : "Approve"}
                          </button>
                        </div>
                      ) : s.status === "approved" ? (
                        <span className="text-xs text-emerald-600 font-medium">✓ Approved</span>
                      ) : s.status === "rejected" ? (
                        <span className="text-xs text-red-500 font-medium">✕ Rejected</span>
                      ) : null}
                    </td>
                  </tr>
                  {showRejectFor === s.id && (
                    <tr key={`${s.id}-reject`} className="bg-red-50/60">
                      <td colSpan={6} className="px-4 pb-3 pt-1">
                        <div className="flex items-end gap-2">
                          <textarea
                            rows={2}
                            placeholder="Notes for the team member (optional)…"
                            value={rejectNotes[s.id] ?? ""}
                            onChange={(e) => setRejectNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            className="flex-1 resize-none rounded-lg border border-red-200 px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                          />
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => setShowRejectFor(null)}
                              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => { setReviewingId(s.id); review(s.id, "rejected"); }}
                              disabled={actionPending}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirm Reject
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
