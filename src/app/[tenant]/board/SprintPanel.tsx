"use client";

import { useState, useTransition } from "react";
import type { Sprint } from "@/lib/repositories/sprints";
import type { Issue } from "@/lib/repositories/issues";
import {
  createSprintAction,
  startSprintAction,
  completeSprintAction,
  addIssueToSprintAction,
  removeIssueFromSprintAction,
} from "./sprintActions";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysLeft(end: string | null) {
  if (!end) return null;
  const d = Math.ceil((new Date(end + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  return d;
}

export default function SprintPanel({
  slug,
  projectId,
  activeSprint,
  plannedSprints,
  sprintIssues,
  backlogIssues,
  canEdit,
}: {
  slug: string;
  projectId: string;
  activeSprint: Sprint | null;
  plannedSprints: Sprint[];
  sprintIssues: Issue[];
  backlogIssues: Issue[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sprint = activeSprint ?? plannedSprints[0] ?? null;
  const done = sprintIssues.filter((i) => i.status === "done").length;
  const total = sprintIssues.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const days = sprint ? daysLeft(sprint.endDate) : null;

  function createSprint() {
    setError(null);
    startTransition(async () => {
      try {
        await createSprintAction(slug, projectId, name || "Sprint 1", goal, startDate, endDate);
        setShowCreate(false);
        setName(""); setGoal(""); setStartDate(""); setEndDate("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function startSprint(id: string) {
    startTransition(() => startSprintAction(slug, id));
  }

  function completeSprint(id: string) {
    if (!confirm("Complete this sprint? Unfinished issues will move to the backlog.")) return;
    startTransition(() => completeSprintAction(slug, id));
  }

  function addToSprint(issueId: string) {
    if (!sprint) return;
    startTransition(() => addIssueToSprintAction(slug, sprint.id, issueId));
  }

  function removeFromSprint(issueId: string) {
    startTransition(() => removeIssueFromSprintAction(slug, issueId));
  }

  return (
    <div className="mb-4 space-y-2">
      {/* Sprint banner */}
      {sprint ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                sprint.status === "active" ? "bg-emerald-100 text-emerald-700" :
                sprint.status === "planned" ? "bg-blue-100 text-blue-700" :
                "bg-neutral-100 text-neutral-500"
              }`}>
                {sprint.status === "active" ? "Active sprint" : sprint.status === "planned" ? "Planned" : "Completed"}
              </span>
              <span className="font-semibold text-neutral-900 truncate">{sprint.name}</span>
              {sprint.goal && <span className="hidden sm:block text-sm text-neutral-500 truncate">— {sprint.goal}</span>}
              {sprint.startDate && (
                <span className="hidden sm:block text-xs text-neutral-400">
                  {fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}
                  {days !== null && sprint.status === "active" && (
                    <span className={`ml-1 font-medium ${days < 0 ? "text-red-600" : days <= 2 ? "text-amber-600" : "text-neutral-500"}`}>
                      {days < 0 ? `(${-days}d overdue)` : days === 0 ? "(ends today)" : `(${days}d left)`}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Progress */}
              {total > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-neutral-500">{done}/{total}</span>
                </div>
              )}

              {canEdit && sprint.status === "planned" && (
                <button
                  onClick={() => startSprint(sprint.id)}
                  disabled={pending}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  Start sprint
                </button>
              )}
              {canEdit && sprint.status === "active" && (
                <button
                  onClick={() => completeSprint(sprint.id)}
                  disabled={pending}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Complete sprint
                </button>
              )}
            </div>
          </div>

          {/* Issue chips for active sprint */}
          {sprint.status === "active" && sprintIssues.length > 0 && canEdit && (
            <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100">
              {sprintIssues.slice(0, 8).map((i) => (
                <button
                  key={i.id}
                  onClick={() => removeFromSprint(i.id)}
                  title="Remove from sprint"
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 hover:bg-red-50 hover:text-red-600"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${i.status === "done" ? "bg-emerald-500" : "bg-neutral-400"}`} />
                  {i.title.length > 30 ? i.title.slice(0, 30) + "…" : i.title}
                  <span className="text-neutral-300">×</span>
                </button>
              ))}
              {sprintIssues.length > 8 && (
                <span className="text-xs text-neutral-400">+{sprintIssues.length - 8} more</span>
              )}
            </div>
          )}
        </div>
      ) : canEdit ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
          >
            + Create sprint
          </button>
        </div>
      ) : null}

      {/* Create sprint form */}
      {showCreate && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">New sprint</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Goal (optional)</label>
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ship user auth"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 mb-1 block">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={createSprint} disabled={pending}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
              {pending ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Backlog toggle */}
      {canEdit && backlogIssues.length > 0 && sprint && sprint.status !== "completed" && (
        <div>
          <button
            onClick={() => setShowBacklog((s) => !s)}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            {showBacklog ? "▾" : "▸"} Backlog ({backlogIssues.length} unscheduled)
          </button>
          {showBacklog && (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-2 text-xs text-neutral-500">Click + to add to the current sprint</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {backlogIssues.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm border border-neutral-100">
                    <span className="truncate text-neutral-700">{i.title}</span>
                    <button
                      onClick={() => addToSprint(i.id)}
                      disabled={pending}
                      className="shrink-0 text-xs text-neutral-400 hover:text-neutral-900 disabled:opacity-50"
                    >
                      + sprint
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
