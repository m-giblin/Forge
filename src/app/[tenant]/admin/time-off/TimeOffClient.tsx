"use client";

import { useState, useTransition } from "react";
import type { TimeOffRow } from "./actions";
import { getAdminTimeOffAction, reviewTimeOffAction } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  pto: "PTO", sick: "Sick", holiday: "Holiday", other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TimeOffClient({ slug, initial }: { slug: string; initial: TimeOffRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [loading, startLoad] = useTransition();
  const [pending, startPending] = useTransition();

  function reload(f?: string) {
    startLoad(async () => {
      const data = await getAdminTimeOffAction(slug, f ?? filter);
      setRows(data);
    });
  }

  function changeFilter(f: typeof filter) {
    setFilter(f);
    reload(f);
  }

  function review(id: string, action: "approved" | "rejected") {
    startPending(async () => {
      await reviewTimeOffAction(slug, id, action);
      reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-neutral-900 flex-1">Time Off Requests</h1>
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
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
          <p className="text-sm font-medium text-neutral-500">No {filter === "all" ? "" : filter} requests</p>
          <p className="text-xs text-neutral-400 mt-1">Team members request time off from their My Time page.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-neutral-900">{r.userName}</p>
                  <span className="rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[10px] font-medium">
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {fmtDate(r.startDate)} → {fmtDate(r.endDate)} · {r.daysCount} {r.daysCount === 1 ? "day" : "days"}
                </p>
                {r.notes && <p className="text-xs text-neutral-400 mt-0.5 truncate">&ldquo;{r.notes}&rdquo;</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[r.status] ?? "bg-neutral-100 text-neutral-500"}`}>
                {r.status}
              </span>
              {r.status === "pending" && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => review(r.id, "rejected")}
                    disabled={loading || pending}
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => review(r.id, "approved")}
                    disabled={loading || pending}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
