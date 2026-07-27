"use client";

import { SideGroupLabel, InfoTooltip, sidebarSelect, sideLabel, avatarColor, avatarInitials } from "./IssueDetailUI";
import IssueAssigneesCard from "./IssueAssigneesCard";
import type { IssuePatch } from "@/lib/services/issues";

type Member = { userId: string; label: string };

export default function IssuePeoplePanel({
  slug,
  issueId,
  members,
  assigneeId,
  initialAssigneeIds,
  readOnly,
  watchers,
  watchPending,
  isWatching,
  setAssigneeId,
  saveField,
  toggleWatch,
}: {
  slug: string;
  issueId: string;
  members: Member[];
  assigneeId: string;
  initialAssigneeIds: string[];
  readOnly: boolean;
  watchers: string[];
  watchPending: boolean;
  isWatching: boolean;
  setAssigneeId: (v: string) => void;
  saveField: (patch: IssuePatch) => void;
  toggleWatch: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <SideGroupLabel color="text-blue-500">👥 People</SideGroupLabel>
      <div>
        <p className={sideLabel}>
          Primary assignee
          <InfoTooltip text="The directly-responsible individual (DRI). Removing them promotes the next assignee. Add more people under Assignees below." />
        </p>
        <select value={assigneeId} disabled={readOnly} onChange={(e) => { setAssigneeId(e.target.value); saveField({ assigneeId: e.target.value || null }); }} className={sidebarSelect}>
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
        </select>
      </div>
      <IssueAssigneesCard
        slug={slug}
        issueId={issueId}
        members={members}
        primaryId={assigneeId || null}
        initialAssigneeIds={initialAssigneeIds}
        readOnly={readOnly}
      />
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className={sideLabel} style={{ marginBottom: 0 }}>
            Watchers ({watchers.length})
            <InfoTooltip text="Team members who receive notifications whenever this issue is updated, commented on, or changes status." />
          </p>
          <button
            onClick={toggleWatch}
            disabled={watchPending}
            className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
              isWatching
                ? "border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {isWatching ? "Watching" : "Watch"}
          </button>
        </div>
        {watchers.length === 0 ? (
          <p className="text-xs text-neutral-400">No watchers yet</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {watchers.map((uid) => {
              const m = members.find((x) => x.userId === uid);
              const label = m?.label ?? "Unknown";
              return (
                <span key={uid} title={label} className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold text-white ${avatarColor(label)}`}>
                  {avatarInitials(label)}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
