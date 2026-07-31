"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addIssueToSprintAction, removeIssueFromSprintAction } from "../board/sprintActions";

type Option = { key: string; label: string; color?: string | null };
type Project = { id: string; key: string; name: string };
type Sprint = { id: string; name: string; status: string; start_date: string; end_date: string };
type IssueRow = { id: string; number: number; title: string; priority: string; storyPoints: number | null };

export default function SprintPlanningClient({
  slug, projects, projectId, plannedSprints, sprintId,
  candidates: initialCandidates, committed: initialCommitted, priorities, capacity, completedSprintCount,
}: {
  slug: string; projects: Project[]; projectId: string;
  plannedSprints: Sprint[]; sprintId: string;
  candidates: IssueRow[]; committed: IssueRow[]; priorities: Option[];
  capacity: number | null; completedSprintCount: number;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [committed, setCommitted] = useState(initialCommitted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const project = projects.find((p) => p.id === projectId);
  const sprint = plannedSprints.find((s) => s.id === sprintId);
  const priMap = new Map(priorities.map((p) => [p.key, p]));
  const committedPoints = committed.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const overCommitted = capacity != null && committedPoints > capacity;

  function switchParam(key: "project" | "sprint", value: string) {
    const params = new URLSearchParams();
    if (key === "project") params.set("project", value);
    else { params.set("project", projectId); params.set("sprint", value); }
    router.push(`/${slug}/sprint-planning?${params.toString()}`);
  }

  function add(issue: IssueRow) {
    if (!sprintId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addIssueToSprintAction(slug, sprintId, issue.id);
        setCandidates((c) => c.filter((i) => i.id !== issue.id));
        setCommitted((c) => [...c, issue]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add to sprint");
      }
    });
  }

  function remove(issue: IssueRow) {
    setError(null);
    startTransition(async () => {
      try {
        await removeIssueFromSprintAction(slug, issue.id);
        setCommitted((c) => c.filter((i) => i.id !== issue.id));
        setCandidates((c) => [...c, issue]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove from sprint");
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Sprint Planning</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Pull candidates into the sprint and watch committed points against your team&apos;s recent capacity.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={projectId}
            onChange={(e) => switchParam("project", e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {plannedSprints.length > 0 && (
            <select
              value={sprintId}
              onChange={(e) => switchParam("sprint", e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {plannedSprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {plannedSprints.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          {project?.name ?? "This project"} has no planned (not-yet-started) sprints — create one from the board first.
        </div>
      ) : (
        <>
          {/* Capacity bar */}
          <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-neutral-800">{sprint?.name}</span>
              <span className={overCommitted ? "font-medium text-red-600" : "text-neutral-500"}>
                {committedPoints} pts committed{capacity != null ? ` / ~${capacity} pts recent capacity` : ""}
              </span>
            </div>
            {capacity != null ? (
              <>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full transition-all ${overCommitted ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, (committedPoints / Math.max(1, capacity)) * 100)}%` }}
                  />
                </div>
                {overCommitted && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    ⚠ Committed points exceed your last {completedSprintCount}-sprint average — consider trimming scope.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-neutral-400">
                  Capacity = average completed points across your last {completedSprintCount} finished sprint{completedSprintCount === 1 ? "" : "s"} on this project — not a per-person hours estimate.
                </p>
              </>
            ) : (
              <p className="text-xs text-neutral-400">Not enough completed sprints yet on this project to estimate capacity — showing committed points only.</p>
            )}
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-neutral-800">Backlog candidates <span className="text-neutral-400">({candidates.length})</span></h2>
              <div className="space-y-2">
                {candidates.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-800">{project?.key}-{i.number} · {i.title}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                        {priMap.get(i.priority) && (
                          <span className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: priMap.get(i.priority)!.color ?? "#9CA3AF" }}>
                            {priMap.get(i.priority)!.label}
                          </span>
                        )}
                        <span className="text-neutral-400">{i.storyPoints ?? "—"} pts</span>
                      </div>
                    </div>
                    <button
                      onClick={() => add(i)}
                      disabled={pending}
                      className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-white disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                ))}
                {candidates.length === 0 && <p className="text-xs text-neutral-400">No unscheduled candidates left.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-neutral-800">Committed to {sprint?.name} <span className="text-neutral-400">({committed.length})</span></h2>
              <div className="space-y-2">
                {committed.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-800">{project?.key}-{i.number} · {i.title}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                        {priMap.get(i.priority) && (
                          <span className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: priMap.get(i.priority)!.color ?? "#9CA3AF" }}>
                            {priMap.get(i.priority)!.label}
                          </span>
                        )}
                        <span className="text-neutral-400">{i.storyPoints ?? "—"} pts</span>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(i)}
                      disabled={pending}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-white disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {committed.length === 0 && <p className="text-xs text-neutral-400">Nothing committed yet.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
