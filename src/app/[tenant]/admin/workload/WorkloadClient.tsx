"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";

export type WorkloadMember = {
  userId: string;
  name: string;
  role: string;
  avatarInitials: string;
  availableMinutesWeek: number;
  loggedMinutesWeek: number;
  estimatedMinutesSprint: number;
  assignedIssueCount: number;
  hoursPerWeek: number;
};

type Props = {
  members: WorkloadMember[];
  activeSprint: { name: string; end_date: string | null } | null;
  slug: string;
  weekStartIso: string;
};

const RED = "#b23b2e";
const GREEN = "#4b7a4f";
const MID = "#3d6a8c"; // muted blue — non-amber mid-tier accent (amber reserved for Super Admin)

function fmtMinutes(mins: number): string {
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function loadChipColors(pct: number): { fg: string; bg: string } {
  if (pct > 100) return { fg: RED, bg: "#f6e2dd" };
  if (pct >= 90) return { fg: MID, bg: "#e0e9ee" };
  return { fg: GREEN, bg: "#e2ebe2" };
}

export default function WorkloadClient({ members, activeSprint, slug, weekStartIso }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedMember = members.find((m) => m.userId === selectedUserId) ?? null;

  const totalCapacityMins = members.reduce((s, m) => s + m.availableMinutesWeek, 0);
  const totalLoggedMins = members.reduce((s, m) => s + m.loggedMinutesWeek, 0);
  const overloadedMembers = members.filter(
    (m) => m.availableMinutesWeek > 0 && m.loggedMinutesWeek / m.availableMinutesWeek > 1,
  );
  const unassignedWithCapacity = members.filter(
    (m) => m.availableMinutesWeek > 0 && m.loggedMinutesWeek === 0 && m.assignedIssueCount === 0,
  );
  const capacityPct = totalCapacityMins > 0 ? Math.round((totalLoggedMins / totalCapacityMins) * 100) : 0;

  const weekLabel = weekStartIso ? `Week of ${fmtDate(weekStartIso)}` : "";
  const subtitle = [weekLabel, activeSprint ? `Active sprint: ${activeSprint.name}` : "No active sprint"]
    .filter(Boolean)
    .join(" · ");

  const rows: AdminTableCell[][] = members.map((m) => {
    const pct = m.availableMinutesWeek > 0 ? Math.round((m.loggedMinutesWeek / m.availableMinutesWeek) * 100) : 0;
    const colors = loadChipColors(pct);
    return [
      {
        kind: "link",
        value: m.name,
        onClick: () => setSelectedUserId(selectedUserId === m.userId ? null : m.userId),
      },
      { kind: "text", value: fmtMinutes(m.loggedMinutesWeek) },
      { kind: "text", value: `${m.hoursPerWeek}h` },
      { kind: "chip", value: `${pct}%`, chipFg: colors.fg, chipBg: colors.bg },
      { kind: "dim", value: String(m.assignedIssueCount) },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workload"
        subtitle={subtitle}
        right={
          <>
            <Link
              href={`/${slug}/admin/workload/timeline`}
              className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db]"
            >
              Timeline view
            </Link>
            <a
              href={`/print/${slug}/workload-report`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db]"
            >
              Export report
            </a>
            <a
              href={`/print/${slug}/team-report`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db]"
            >
              Export team report
            </a>
          </>
        }
      />

      <div className="space-y-6 px-6">
        {members.length === 0 ? (
          <div className="fw-card py-16 text-center text-[12.5px] text-[#a19d90]">
            No team members found for this workspace.
          </div>
        ) : (
          <>
            <StatsRow
              items={[
                {
                  label: "Team capacity",
                  value: `${Math.round(totalCapacityMins / 60)}h`,
                  hint: `${members.length} member${members.length !== 1 ? "s" : ""}`,
                },
                {
                  label: "Logged this week",
                  value: fmtMinutes(totalLoggedMins),
                  hint: `${capacityPct}% of capacity`,
                  color: capacityPct > 100 ? RED : undefined,
                },
                {
                  label: "Overallocated",
                  value: overloadedMembers.length,
                  hint: overloadedMembers.length > 0 ? overloadedMembers.map((m) => m.name).join(", ") : "none",
                  color: overloadedMembers.length > 0 ? RED : undefined,
                },
                {
                  label: "Unassigned capacity",
                  value: unassignedWithCapacity.length,
                  hint: unassignedWithCapacity.length > 0 ? "needs an owner" : "all assigned",
                  color: unassignedWithCapacity.length > 0 ? MID : undefined,
                },
              ]}
            />

            <AdminTable
              minWidth={640}
              columns={[
                { label: "Member", flex: true },
                { label: "Logged", width: 110 },
                { label: "Capacity", width: 110 },
                { label: "Load", width: 90 },
                { label: "Issues", width: 90 },
              ]}
              rows={rows}
            />
          </>
        )}
      </div>

      {selectedMember && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm flex flex-col border-l border-[#ddd8c9] bg-[#faf8f2] shadow-xl">
          <div className="flex items-center justify-between border-b border-[#e3ded0] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1e4d7] text-[12px] font-bold text-[#8c4632]">
                {selectedMember.avatarInitials}
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#20201d]">{selectedMember.name}</p>
                <p className="text-[11px] capitalize text-[#a19d90]">{selectedMember.role}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedUserId(null)}
              className="rounded-md p-1.5 text-[#a19d90] hover:bg-[#eae6da] hover:text-[#4a473e]"
              aria-label="Close panel"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4L4 12M4 4l8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div className="fw-card space-y-3 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Capacity</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[17px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">
                    {selectedMember.hoursPerWeek}h
                  </p>
                  <p className="text-[10.5px] text-[#a19d90]">Available/wk</p>
                </div>
                <div>
                  <p className="text-[17px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">
                    {fmtMinutes(selectedMember.loggedMinutesWeek)}
                  </p>
                  <p className="text-[10.5px] text-[#a19d90]">Logged</p>
                </div>
                <div>
                  <p className="text-[17px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">
                    {fmtMinutes(selectedMember.estimatedMinutesSprint)}
                  </p>
                  <p className="text-[10.5px] text-[#a19d90]">Estimated</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Sprint assignment</p>
              {selectedMember.assignedIssueCount === 0 ? (
                <p className="text-[12px] text-[#a19d90]">No issues assigned in active sprint.</p>
              ) : (
                <div className="fw-card divide-y divide-[#e3ded0]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-[#4a473e]">Assigned issues</span>
                    <span className="text-[12.5px] font-bold text-[#20201d]">{selectedMember.assignedIssueCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-[#4a473e]">Total estimated</span>
                    <span className="text-[12.5px] font-bold text-[#20201d]">{fmtMinutes(selectedMember.estimatedMinutesSprint)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <a
                href={`/${slug}/board?assignee=${selectedMember.userId}`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#b7452f] hover:underline"
              >
                View their issues on the board →
              </a>
            </div>
          </div>
        </div>
      )}

      {selectedUserId && (
        <div className="fixed inset-0 z-30 bg-black/10" onClick={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}
