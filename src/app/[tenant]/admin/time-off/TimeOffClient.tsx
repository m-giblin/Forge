"use client";

import { useState, useTransition } from "react";
import type { TimeOffRow } from "./actions";
import { getAdminTimeOffAction, reviewTimeOffAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import Note from "@/components/patterns/admin/Note";

const TYPE_LABELS: Record<string, string> = {
  pto: "PTO", sick: "Sick", holiday: "Holiday", other: "Other",
};

// Status chip colors — rust for approved, muted blue for pending, dim rust for rejected. Amber is reserved for Super Admin.
const STATUS_CHIP: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "#3a6ea8", bg: "#eaf1f8" },
  approved: { fg: "#4b7a4f", bg: "#e9f2ea" },
  rejected: { fg: "#b7452f", bg: "#fbeae8" },
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
    const notes = action === "rejected" ? rejectNotes[id] : undefined;
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: action } : r));
    setShowRejectFor(null);
    startAction(async () => {
      const res = await reviewTimeOffAction(slug, id, action, notes);
      if (!res.ok) {
        reload();
      } else {
        reload();
      }
    });
  }

  const columns = [
    { label: "Member", flex: true },
    { label: "Type", width: 130 },
    { label: "Dates", width: 190 },
    { label: "Days", width: 90 },
    { label: "Status", width: 120 },
    { label: "", width: 170 },
  ];

  const tableRows: AdminTableCell[][] = rows.map((r) => {
    const chip = STATUS_CHIP[r.status] ?? { fg: "#4a473e", bg: "#f1efe9" };
    const actionCell: AdminTableCell =
      r.status === "pending"
        ? {
            kind: "link",
            value: showRejectFor === r.id ? "Cancel reject" : "Approve · Reject",
            onClick: () => {
              if (showRejectFor === r.id) {
                setShowRejectFor(null);
              } else {
                review(r.id, "approved");
              }
            },
          }
        : { kind: "dim", value: "View" };

    return [
      { kind: "text", value: r.userName },
      { kind: "text", value: TYPE_LABELS[r.type] ?? r.type },
      { kind: "text", value: `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}` },
      { kind: "text", value: r.daysCount },
      { kind: "chip", value: r.status.charAt(0).toUpperCase() + r.status.slice(1), chipFg: chip.fg, chipBg: chip.bg },
      actionCell,
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Off Requests"
        subtitle="Approve or reject planned absences"
        right={
          <div className="flex gap-1 rounded-[6px] border border-[#ddd8c9] bg-[#f4f2eb] p-1">
            {(["pending", "approved", "rejected", "all"] as FilterTab[]).map((f) => (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                disabled={loading}
                className={`whitespace-nowrap rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                  filter === f ? "bg-white text-[#20201d] shadow-sm" : "text-[#a19d90] hover:text-[#4a473e]"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-4 px-6">
        {rows.length === 0 ? (
          <div className="fw-card py-16 text-center">
            <p className="text-[13px] font-semibold text-[#726e60]">
              No {filter === "all" ? "" : filter} time off requests
            </p>
            <p className="mt-1 text-[11.5px] text-[#a19d90]">Team members request time off from their My Time page.</p>
          </div>
        ) : (
          <>
            <AdminTable columns={columns} rows={tableRows} />

            {showRejectFor && (
              <div className="fw-card flex items-end gap-2 px-3.5 py-3">
                <label className="flex-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">
                    Reason for rejection
                  </span>
                  <textarea
                    rows={2}
                    placeholder="Optional…"
                    value={rejectNotes[showRejectFor] ?? ""}
                    onChange={(e) => setRejectNotes((prev) => ({ ...prev, [showRejectFor]: e.target.value }))}
                    className="mt-1 w-full resize-none rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12px] text-[#20201d] outline-none focus:border-[#b7452f]"
                  />
                </label>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => setShowRejectFor(null)}
                    className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => review(showRejectFor, "rejected")}
                    disabled={actionPending}
                    className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                    style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
                  >
                    Confirm reject
                  </button>
                </div>
              </div>
            )}

            <Note tone="info" icon="ℹ️">
              Approved time off is subtracted from sprint capacity automatically.
            </Note>
          </>
        )}
      </div>
    </div>
  );
}
