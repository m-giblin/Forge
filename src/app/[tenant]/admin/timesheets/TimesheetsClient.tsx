"use client";

import { useState, useTransition } from "react";
import type { TimesheetRow } from "./actions";
import { getAdminTimesheetsAction, reviewTimesheetAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";

const RED = "#b23b2e";
const GREEN = "#4b7a4f";
const MID = "#3d6a8c"; // muted blue — non-amber "pending" accent (amber reserved for Super Admin)

function fmtHours(m: number) {
  if (m <= 0) return "0h";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  submitted: { fg: MID, bg: "#e0e9ee" },
  approved: { fg: GREEN, bg: "#e2ebe2" },
  rejected: { fg: RED, bg: "#f6e2dd" },
  draft: { fg: "#726e60", bg: "#f1efe9" },
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
  const rejectTarget = sheets.find((s) => s.id === showRejectFor) ?? null;

  const rows: AdminTableCell[][] = sheets.map((s) => {
    const colors = STATUS_COLORS[s.status] ?? { fg: "#4a473e", bg: "#f1efe9" };
    const actionCell: AdminTableCell =
      s.status === "submitted"
        ? {
            kind: "text",
            value:
              actionPending && reviewingId === s.id ? (
                <span className="text-[12.5px] text-[#a19d90]">…</span>
              ) : (
                <span className="flex justify-end gap-2.5 text-[12.5px] font-semibold">
                  <button
                    type="button"
                    onClick={() => { setReviewingId(s.id); review(s.id, "approved"); }}
                    disabled={actionPending}
                    className="text-[#4b7a4f] hover:underline disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <span className="text-[#ddd8c9]">·</span>
                  <button
                    type="button"
                    onClick={() => setShowRejectFor(showRejectFor === s.id ? null : s.id)}
                    disabled={actionPending}
                    className="text-[#b23b2e] hover:underline disabled:opacity-50"
                  >
                    Reject
                  </button>
                </span>
              ),
          }
        : { kind: "dim", value: s.status === "approved" ? "✓ Approved" : s.status === "rejected" ? "✕ Rejected" : "—" };

    return [
      { kind: "bold", value: s.userName },
      { kind: "text", value: fmtDate(s.weekStart) },
      { kind: "text", value: fmtHours(s.totalMinutes) },
      { kind: "chip", value: s.status, chipFg: colors.fg, chipBg: colors.bg },
      { kind: "dim", value: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—" },
      actionCell,
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet Approvals"
        subtitle="Submitted weeks awaiting your review"
        right={
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadWeek(addWeeks(weekStart, -1))}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#ede9db] disabled:opacity-40"
              aria-label="Previous week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[180px] px-2 text-center text-[11.5px] font-semibold text-[#4a473e]">
              {fmtWeekLabel(weekStart)}
            </span>
            <button
              onClick={() => loadWeek(addWeeks(weekStart, 1))}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#ede9db] disabled:opacity-40"
              aria-label="Next week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => loadWeek(getCurrentWeekStart())}
                className="ml-1 rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1.5 text-[11px] font-semibold text-[#4a473e] hover:bg-[#ede9db]"
              >
                Current week
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-6 px-6">
        <StatsRow
          items={[
            { label: "Pending", value: submitted.length, hint: "awaiting approval", color: submitted.length > 0 ? MID : undefined },
            { label: "Approved", value: approved.length, hint: "this week", color: GREEN },
            { label: "Rejected", value: rejected.length, hint: "this week", color: rejected.length > 0 ? RED : undefined },
            { label: "Total hours", value: fmtHours(totalTeamHours), hint: "logged this week" },
          ]}
        />

        {sheets.length === 0 ? (
          <div className="fw-card py-16 text-center">
            <p className="text-[12.5px] font-semibold text-[#726e60]">No submitted timesheets for this week</p>
            <p className="mt-1 text-[11px] text-[#a19d90]">Team members submit their weekly time from the My Time page.</p>
          </div>
        ) : (
          <>
            <AdminTable
              minWidth={760}
              columns={[
                { label: "Member", flex: true },
                { label: "Week", width: 150 },
                { label: "Hours", width: 90 },
                { label: "Status", width: 110 },
                { label: "Submitted", width: 110 },
                { label: "", width: 160 },
              ]}
              rows={rows}
            />

            {rejectTarget && (
              <div className="fw-card space-y-3 p-4">
                <p className="text-[11.5px] font-semibold text-[#20201d]">
                  Reject {rejectTarget.userName}&rsquo;s timesheet for {fmtDate(rejectTarget.weekStart)}
                </p>
                <textarea
                  rows={2}
                  placeholder="Notes for the team member (optional)…"
                  value={rejectNotes[rejectTarget.id] ?? ""}
                  onChange={(e) => setRejectNotes((prev) => ({ ...prev, [rejectTarget.id]: e.target.value }))}
                  className="w-full resize-none rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12px] text-[#20201d] focus:outline-none focus:ring-2 focus:ring-[#b7452f]/30"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowRejectFor(null)}
                    className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setReviewingId(rejectTarget.id); review(rejectTarget.id, "rejected"); }}
                    disabled={actionPending}
                    className="rounded-[5px] border border-[#8c3226] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-60"
                    style={{ background: "linear-gradient(160deg,#b23b2e,#8c3226)" }}
                  >
                    Confirm reject
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
