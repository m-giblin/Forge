"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateIssueAction } from "../issues/[id]/actions";

type Status = { key: string; label: string };
type Option = { key: string; label: string; color?: string | null };
type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };
type Issue = {
  id: string; number: number; title: string; status: string; type: string;
  priority: string; assigneeId: string | null; storyPoints: number | null;
};

export default function BacklogClient({
  slug, projects, projectId, statusOptions, backlogStatusKey, readyStatus, types, priorities, members, issues: initialIssues,
}: {
  slug: string; projects: Project[]; projectId: string;
  statusOptions: Status[]; backlogStatusKey: string | null; readyStatus: Status | null;
  types: Option[]; priorities: Option[]; members: Member[]; issues: Issue[];
}) {
  const router = useRouter();
  const [issues, setIssues] = useState(initialIssues);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const project = projects.find((p) => p.id === projectId);
  const typeMap = new Map(types.map((t) => [t.key, t.label]));
  const priMap = new Map(priorities.map((p) => [p.key, p]));
  const memberMap = new Map(members.map((m) => [m.userId, m.label]));

  const grouped = useMemo(() => {
    const groups = new Map<string, Issue[]>();
    for (const s of statusOptions) groups.set(s.key, []);
    for (const i of issues) {
      const list = groups.get(i.status) ?? [];
      list.push(i);
      groups.set(i.status, list);
    }
    return groups;
  }, [issues, statusOptions]);

  function switchProject(id: string) {
    router.push(`/${slug}/backlog?project=${id}`);
  }

  function markReady(issue: Issue) {
    if (!readyStatus) return;
    setError(null);
    setPendingId(issue.id);
    startTransition(async () => {
      try {
        await updateIssueAction(slug, issue.id, { status: readyStatus.key });
        setIssues((cur) => cur.map((i) => (i.id === issue.id ? { ...i, status: readyStatus.key } : i)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to mark ready");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Backlog</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Everything not yet scheduled into a sprint, grouped by where it&apos;s stuck.
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Different from{" "}
            <Link href={`/${slug}/backlog-refinement`} className="underline hover:text-neutral-600">
              Backlog Refinement
            </Link>{" "}
            in the gear menu — that&apos;s a one-card-at-a-time grooming session. This is the browsable overview: everything unscheduled at a glance, across every status.
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

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {statusOptions.length === 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          This workspace has no statuses configured.
        </div>
      )}

      {issues.length === 0 && statusOptions.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
          Nothing unscheduled in {project?.name ?? "this project"} — the backlog is empty.
        </div>
      )}

      <div className="mt-6 space-y-6">
        {statusOptions.map((s) => {
          const group = grouped.get(s.key) ?? [];
          if (group.length === 0) return null;
          return (
            <div key={s.key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {s.label} <span className="text-neutral-300">· {group.length}</span>
              </p>
              <div className="space-y-1.5">
                {group.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 shadow-sm"
                  >
                    <span className="shrink-0 font-mono text-xs text-neutral-400">{project?.key}-{issue.number}</span>
                    <Link
                      href={`/${slug}/issues/${issue.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 hover:underline"
                    >
                      {issue.title}
                    </Link>
                    <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                      {typeMap.get(issue.type) ?? issue.type}
                    </span>
                    {priMap.get(issue.priority) && (
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-white"
                        style={{ backgroundColor: priMap.get(issue.priority)!.color ?? "#9CA3AF" }}
                      >
                        {priMap.get(issue.priority)!.label}
                      </span>
                    )}
                    {issue.storyPoints != null && (
                      <span className="shrink-0 text-xs text-neutral-400">{issue.storyPoints} pts</span>
                    )}
                    <span className="hidden shrink-0 w-28 truncate text-xs text-neutral-400 sm:block">
                      {issue.assigneeId ? memberMap.get(issue.assigneeId) ?? "?" : "Unassigned"}
                    </span>
                    {issue.status === backlogStatusKey && readyStatus && (
                      <button
                        onClick={() => markReady(issue)}
                        disabled={pendingId === issue.id}
                        className="shrink-0 rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {pendingId === issue.id ? "…" : `Mark ready`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
