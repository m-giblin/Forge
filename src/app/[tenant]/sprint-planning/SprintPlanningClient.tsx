"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addIssueToSprintAction, removeIssueFromSprintAction } from "../board/sprintActions";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import Note from "@/components/patterns/admin/Note";
import SectionGroup from "@/components/patterns/SectionGroup";

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
  const pctOfCapacity = capacity != null ? Math.round((committedPoints / Math.max(1, capacity)) * 100) : null;

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
      <PageHeader
        title="Sprint Planning"
        subtitle="Pull backlog candidates into the next sprint"
        right={
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <select
              value={projectId}
              onChange={(e) => switchParam("project", e.target.value)}
              className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[11.5px] font-semibold text-[#4a473e] outline-none focus:border-[#b7452f]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {plannedSprints.length > 0 && (
              <select
                value={sprintId}
                onChange={(e) => switchParam("sprint", e.target.value)}
                className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[11.5px] font-semibold text-[#4a473e] outline-none focus:border-[#b7452f]"
              >
                {plannedSprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        }
      />

      <div className="space-y-5 px-6 py-5">
        {plannedSprints.length === 0 ? (
          <div className="fw-card px-6 py-10 text-center text-[12.5px] text-[#a19d90]">
            {project?.name ?? "This project"} has no planned (not-yet-started) sprints — create one from the board first.
          </div>
        ) : (
          <>
            <StatsRow
              items={[
                { label: "Committed", value: `${committedPoints} pts`, hint: capacity != null ? `of ${capacity} pt capacity` : "no capacity baseline yet" },
                { label: "Candidates", value: candidates.length, hint: "unscheduled issues" },
                { label: "Velocity", value: capacity != null ? `${capacity} pts` : "—", hint: `avg of last ${completedSprintCount} sprint${completedSprintCount === 1 ? "" : "s"}` },
                { label: "Team capacity", value: capacity != null ? `${capacity} pts` : "—", hint: "after time off" },
              ]}
            />

            {capacity != null && (
              <div className="fw-card px-4 py-3.5">
                <div className="mb-2 flex items-center justify-between text-[12.5px]">
                  <span className="font-bold text-[#20201d]">{sprint?.name}</span>
                  <span className={overCommitted ? "font-semibold text-[#c0392b]" : "text-[#726e60]"}>
                    {committedPoints} pts committed / ~{capacity} pts recent capacity
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e3ded0]">
                  <div
                    className={`h-full rounded-full transition-all ${overCommitted ? "bg-[#c0392b]" : "bg-[#8c4632]"}`}
                    style={{ width: `${Math.min(100, pctOfCapacity ?? 0)}%` }}
                  />
                </div>
              </div>
            )}

            {overCommitted ? (
              <Note icon="⚠️" tone="warning">
                Committed points exceed your last {completedSprintCount}-sprint average — consider trimming scope.
              </Note>
            ) : capacity != null ? (
              <Note icon="📊" tone="info">
                You are at {pctOfCapacity}% of capacity. Capacity = average completed points across your last {completedSprintCount} finished sprint{completedSprintCount === 1 ? "" : "s"} on this project.
              </Note>
            ) : (
              <Note icon="📊" tone="info">
                Not enough completed sprints yet on this project to estimate capacity — showing committed points only.
              </Note>
            )}

            {error && <p className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</p>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionGroup label="Backlog candidates" color="#a19d90" count={candidates.length}>
                {candidates.map((i, idx) => (
                  <div
                    key={i.id}
                    className={`flex items-center gap-3 px-3.5 py-[11px] ${idx > 0 ? "border-t border-[#e3ded0]" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-[#20201d]">{project?.key}-{i.number} · {i.title}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                        {priMap.get(i.priority) && (
                          <span className="rounded px-1.5 py-0.5 font-semibold text-white" style={{ backgroundColor: priMap.get(i.priority)!.color ?? "#a19d90" }}>
                            {priMap.get(i.priority)!.label}
                          </span>
                        )}
                        <span className="text-[#a19d90]">{i.storyPoints ?? "—"} pts</span>
                      </div>
                    </div>
                    <button
                      onClick={() => add(i)}
                      disabled={pending}
                      className="shrink-0 text-[11.5px] font-semibold text-[#b7452f] hover:underline disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                ))}
                {candidates.length === 0 && <p className="px-3.5 py-4 text-[11.5px] text-[#a19d90]">No unscheduled candidates left.</p>}
              </SectionGroup>

              <SectionGroup label={`Committed to ${sprint?.name ?? "sprint"}`} color="#3f7d4c" count={committed.length}>
                {committed.map((i, idx) => (
                  <div
                    key={i.id}
                    className={`flex items-center gap-3 px-3.5 py-[11px] ${idx > 0 ? "border-t border-[#e3ded0]" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-[#20201d]">{project?.key}-{i.number} · {i.title}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                        {priMap.get(i.priority) && (
                          <span className="rounded px-1.5 py-0.5 font-semibold text-white" style={{ backgroundColor: priMap.get(i.priority)!.color ?? "#a19d90" }}>
                            {priMap.get(i.priority)!.label}
                          </span>
                        )}
                        <span className="text-[#a19d90]">{i.storyPoints ?? "—"} pts</span>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(i)}
                      disabled={pending}
                      className="shrink-0 text-[11.5px] font-semibold text-[#c0392b] hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {committed.length === 0 && <p className="px-3.5 py-4 text-[11.5px] text-[#a19d90]">Nothing committed yet.</p>}
              </SectionGroup>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
