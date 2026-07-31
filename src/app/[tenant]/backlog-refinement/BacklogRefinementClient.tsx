"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIssueAction } from "../issues/[id]/actions";

type Status = { key: string; label: string } | null;
type Option = { key: string; label: string; color?: string | null };
type Issue = { id: string; number: number; title: string; description: string | null; type: string; priority: string; storyPoints: number | null };
type Project = { id: string; key: string; name: string };

const QUICK_POINTS = [1, 2, 3, 5, 8, 13, 21];

export default function BacklogRefinementClient({
  slug, projects, projectId, backlogStatus, readyStatus, types, priorities, issues: initialIssues,
}: {
  slug: string; projects: Project[]; projectId: string;
  backlogStatus: Status; readyStatus: Status;
  types: Option[]; priorities: Option[]; issues: Issue[];
}) {
  const router = useRouter();
  const issues = initialIssues;
  const [index, setIndex] = useState(0);
  const [points, setPoints] = useState<string>("");
  const [refinedCount, setRefinedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const project = projects.find((p) => p.id === projectId);
  const typeMap = new Map(types.map((t) => [t.key, t.label]));
  const priMap = new Map(priorities.map((p) => [p.key, p]));
  const current = issues[index];
  const totalStarted = initialIssues.length;

  function switchProject(id: string) {
    router.push(`/${slug}/backlog-refinement?project=${id}`);
  }

  function skip() {
    setPoints("");
    setIndex((i) => Math.min(i + 1, issues.length));
  }

  function markReady() {
    if (!current || !readyStatus) return;
    setError(null);
    const parsed = points.trim() ? parseFloat(points) : null;
    startTransition(async () => {
      try {
        await updateIssueAction(slug, current.id, {
          status: readyStatus.key,
          storyPoints: parsed !== null && !Number.isNaN(parsed) ? parsed : undefined,
        });
        setRefinedCount((c) => c + 1);
        setPoints("");
        setIndex((i) => Math.min(i + 1, issues.length));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to mark ready");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Backlog Refinement</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Work through {backlogStatus?.label ?? "Backlog"} one issue at a time — set points, then move it to {readyStatus?.label ?? "the next step"}.
          </p>
        </div>
        <select
          value={projectId}
          onChange={(e) => switchProject(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs text-neutral-500">
        <span>{project ? `${project.key} · ` : ""}{refinedCount} refined this session</span>
        <span>{Math.min(index, totalStarted)} / {totalStarted}</span>
      </div>

      {!backlogStatus && (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          This workspace has no statuses configured.
        </div>
      )}

      {backlogStatus && totalStarted === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Nothing in {backlogStatus.label} for this project — you&apos;re all refined.
        </div>
      )}

      {backlogStatus && totalStarted > 0 && !current && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-lg font-semibold text-emerald-800">Session complete 🎉</p>
          <p className="mt-1 text-sm text-emerald-700">Refined {refinedCount} of {totalStarted} issues.</p>
        </div>
      )}

      {current && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="font-mono">{project?.key}-{current.number}</span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.5">{typeMap.get(current.type) ?? current.type}</span>
            {priMap.get(current.priority) && (
              <span className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: priMap.get(current.priority)!.color ?? "#9CA3AF" }}>
                {priMap.get(current.priority)!.label}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">{current.title}</h2>
          {current.description && (
            <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-neutral-600">{current.description}</p>
          )}

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Story points</p>
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_POINTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPoints(String(p))}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    points === String(p) ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <input
                type="number"
                min={0}
                step={0.5}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="Custom…"
                className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
              />
              {current.storyPoints != null && (
                <span className="text-xs text-neutral-400">currently {current.storyPoints}</span>
              )}
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex gap-2">
            <button
              onClick={markReady}
              disabled={pending || !readyStatus}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : `Mark ready → ${readyStatus?.label ?? ""}`}
            </button>
            <button
              onClick={skip}
              disabled={pending}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
