"use client";

import { useState } from "react";

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

function capacityColor(pct: number): string {
  if (pct > 110) return "bg-red-500";
  if (pct > 90) return "bg-orange-500";
  if (pct > 70) return "bg-amber-400";
  return "bg-emerald-500";
}

function capacityTextColor(pct: number): string {
  if (pct > 110) return "text-red-600";
  if (pct > 90) return "text-orange-600";
  if (pct > 70) return "text-amber-600";
  return "text-emerald-600";
}

function CapacityBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const clampedWidth = Math.min(pct, 100);
  const color = capacityColor(pct);
  const textColor = capacityTextColor(pct);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="relative flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden"
        title={label}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums w-8 text-right ${textColor}`}>
        {pct}%
      </span>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "bg-violet-50 text-violet-700 border border-violet-200",
    admin: "bg-blue-50 text-blue-700 border border-blue-200",
    member: "bg-neutral-100 text-neutral-600 border border-neutral-200",
    viewer: "bg-neutral-50 text-neutral-400 border border-neutral-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[role] ?? styles.member}`}>
      {role}
    </span>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
      <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}

export default function WorkloadClient({ members, activeSprint, slug, weekStartIso }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const selectedMember = members.find((m) => m.userId === selectedUserId) ?? null;

  // Summary stats
  const totalCapacityMins = members.reduce((s, m) => s + m.availableMinutesWeek, 0);
  const totalLoggedMins = members.reduce((s, m) => s + m.loggedMinutesWeek, 0);
  const totalEstimatedMins = members.reduce((s, m) => s + m.estimatedMinutesSprint, 0);
  const overloadedCount = members.filter((m) =>
    m.availableMinutesWeek > 0 && m.loggedMinutesWeek / m.availableMinutesWeek >= 0.9
  ).length;

  const weekLabel = weekStartIso
    ? `Week of ${fmtDate(weekStartIso)}`
    : "";

  if (members.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-400 text-sm">
        No team members found for this workspace.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Team Workload</h2>
          <p className="mt-0.5 text-sm text-neutral-500">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeSprint ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                Active: {activeSprint.name}
              </span>
              {activeSprint.end_date && (
                <span className="text-xs text-neutral-400">
                  Ends {fmtDate(activeSprint.end_date)}
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500">
              No active sprint
            </span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatTile
          label="Total capacity"
          value={`${Math.round(totalCapacityMins / 60)}h`}
          sub="this week"
        />
        <StatTile
          label="Logged this week"
          value={fmtMinutes(totalLoggedMins)}
          sub={totalCapacityMins > 0 ? `${Math.round((totalLoggedMins / totalCapacityMins) * 100)}% of capacity` : undefined}
        />
        <StatTile
          label="Estimated (sprint)"
          value={fmtMinutes(totalEstimatedMins)}
          sub={activeSprint ? activeSprint.name : "no active sprint"}
        />
        <StatTile
          label="At / over capacity"
          value={String(overloadedCount)}
          sub={`of ${members.length} member${members.length !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Member cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => {
          const loggedPct = m.availableMinutesWeek > 0
            ? Math.round((m.loggedMinutesWeek / m.availableMinutesWeek) * 100)
            : 0;
          const isSelected = selectedUserId === m.userId;

          return (
            <button
              key={m.userId}
              onClick={() => setSelectedUserId(isSelected ? null : m.userId)}
              className={`w-full text-left rounded-xl border bg-white px-5 py-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isSelected ? "border-blue-400 shadow-md ring-1 ring-blue-300" : "border-neutral-200"
              }`}
            >
              {/* Avatar + name row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                    {m.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{m.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {m.assignedIssueCount} issue{m.assignedIssueCount !== 1 ? "s" : ""} this sprint
                    </p>
                  </div>
                </div>
                <RoleBadge role={m.role} />
              </div>

              {/* Capacity rows */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 w-20 flex-shrink-0">Available</span>
                  <span className="text-xs font-medium text-neutral-700">{m.hoursPerWeek}h/wk</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 w-20 flex-shrink-0">Logged</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-neutral-700 w-16 flex-shrink-0">
                      {fmtMinutes(m.loggedMinutesWeek)}
                    </span>
                    <CapacityBar
                      value={m.loggedMinutesWeek}
                      max={m.availableMinutesWeek}
                      label={`${fmtMinutes(m.loggedMinutesWeek)} logged of ${m.hoursPerWeek}h available`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 w-20 flex-shrink-0">Estimated</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-neutral-700 w-16 flex-shrink-0">
                      {fmtMinutes(m.estimatedMinutesSprint)}
                    </span>
                    <CapacityBar
                      value={m.estimatedMinutesSprint}
                      max={m.availableMinutesWeek}
                      label={`${fmtMinutes(m.estimatedMinutesSprint)} estimated in sprint`}
                    />
                  </div>
                </div>
              </div>

              {/* Overload warning */}
              {loggedPct > 110 && (
                <p className="mt-3 text-xs font-medium text-red-600 flex items-center gap-1">
                  <span>⚠</span> Overloaded — {loggedPct}% of weekly capacity
                </p>
              )}
              {loggedPct > 90 && loggedPct <= 110 && (
                <p className="mt-3 text-xs font-medium text-orange-600 flex items-center gap-1">
                  <span>●</span> At capacity — {loggedPct}%
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Slide-in detail panel */}
      {selectedMember && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white border-l border-neutral-200 shadow-xl flex flex-col">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                {selectedMember.avatarInitials}
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{selectedMember.name}</p>
                <RoleBadge role={selectedMember.role} />
              </div>
            </div>
            <button
              onClick={() => setSelectedUserId(null)}
              className="rounded-md p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="Close panel"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4L4 12M4 4l8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Capacity summary */}
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Capacity</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold text-neutral-900 tabular-nums">
                    {selectedMember.hoursPerWeek}h
                  </p>
                  <p className="text-xs text-neutral-400">Available/wk</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900 tabular-nums">
                    {fmtMinutes(selectedMember.loggedMinutesWeek)}
                  </p>
                  <p className="text-xs text-neutral-400">Logged</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-neutral-900 tabular-nums">
                    {fmtMinutes(selectedMember.estimatedMinutesSprint)}
                  </p>
                  <p className="text-xs text-neutral-400">Estimated</p>
                </div>
              </div>
            </div>

            {/* Sprint assignment info */}
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Sprint assignment</p>
              {selectedMember.assignedIssueCount === 0 ? (
                <p className="text-sm text-neutral-400">No issues assigned in active sprint.</p>
              ) : (
                <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-700">Assigned issues</span>
                    <span className="text-sm font-semibold text-neutral-900">{selectedMember.assignedIssueCount}</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-700">Total estimated</span>
                    <span className="text-sm font-semibold text-neutral-900">{fmtMinutes(selectedMember.estimatedMinutesSprint)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Link to board filtered by user */}
            <div className="pt-2">
              <a
                href={`/${slug}/board?assignee=${selectedMember.userId}`}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View their issues on the board
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 8h8M8 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Overlay behind panel */}
      {selectedUserId && (
        <div
          className="fixed inset-0 z-30 bg-black/10"
          onClick={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
