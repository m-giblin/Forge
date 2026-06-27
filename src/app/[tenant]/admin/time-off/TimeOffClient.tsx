"use client";

import { useState, useTransition } from "react";
import type { TimeOffRow } from "./actions";
import { getAdminTimeOffAction, reviewTimeOffAction } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  pto: "PTO", sick: "Sick", holiday: "Holiday", other: "Other",
};

const TYPE_STYLES: Record<string, string> = {
  pto: "bg-blue-100 text-blue-700",
  sick: "bg-orange-100 text-orange-700",
  holiday: "bg-purple-100 text-purple-700",
  other: "bg-neutral-100 text-neutral-600",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtSubmittedDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

type FilterTab = "pending" | "approved" | "rejected" | "all";

export default function TimeOffClient({ slug, initial }: { slug: string; initial: TimeOffRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [loading, startLoad] = useTransition();
  const [actionPending, startAction] = useTransition();
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  function reload(f?: string) {
    const target = f ?? filter;
    startLoad(async () => {
      const data = await getAdminTimeOffAction(slug, target === "all" ? undefined : target);
      setRows(data);
    });
  }

  function changeFilter(f: FilterTab) {
    setFilter(f);
    startLoad(async () => {
      const data = await getAdminTimeOffAction(slug, f === "all" ? undefined : f);
      setRows(data);
    });
  }

  function review(id: string, action: "approved" | "rejected") {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: action } : r));
    setShowRejectFor(null);
    startAction(async () => {
      const res = await reviewTimeOffAction(slug, id, action);
      if (!res.ok) {
        reload();
      } else {
        reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-neutral-900 flex-1">Time Off Requests</h1>
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          {(["pending", "approved", "rejected", "all"] as FilterTab[]).map((f) => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                filter === f ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
          <p className="text-sm font-medium text-neutral-500">
            No {filter === "all" ? "" : filter} time off requests
          </p>
          <p className="text-xs text-neutral-400 mt-1">Team members request time off from their My Time page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {getInitials(r.userName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-neutral-900">{r.userName}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLES[r.type] ?? "bg-neutral-100 text-neutral-600"}`}>
                      {TYPE_LABELS[r.type] ?? r.type}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[r.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                    <span className="mx-1.5 text-neutral-300">·</span>
                    {r.daysCount} {r.daysCount === 1 ? "day" : "days"}
                    <span className="mx-1.5 text-neutral-300">·</span>
                    Submitted {fmtSubmittedDate(r.createdAt)}
                  </p>
                  {r.notes && (
                    <p className="mt-1 text-xs text-neutral-400 italic">&ldquo;{r.notes}&rdquo;</p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setShowRejectFor(showRejectFor === r.id ? null : r.id)}
                      disabled={loading || actionPending}
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => review(r.id, "approved")}
                      disabled={loading || actionPending}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>

              {showRejectFor === r.id && (
                <div className="flex items-end gap-2 pt-1 border-t border-neutral-100">
                  <textarea
                    rows={2}
                    placeholder="Reason for rejection (optional)…"
                    value={rejectNotes[r.id] ?? ""}
                    onChange={(e) => setRejectNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="flex-1 resize-none rounded-lg border border-red-200 px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-red-300 bg-red-50/30"
                  />
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setShowRejectFor(null)}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => review(r.id, "rejected")}
                      disabled={actionPending}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
