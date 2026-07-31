"use client";

import { useState } from "react";

type Option = { key: string; label: string; color?: string | null };
type GuestIssue = { id: string; number: number; title: string; status: string; priority: string; type: string; assigneeName: string | null };
type Phase = { id: string; name: string; color: string; start_date: string | null; end_date: string | null } | null;

export default function GuestProjectView({
  project, phase, statuses, priorities, types, issues,
}: {
  project: { key: string; name: string; targetGoLive: string | null };
  phase: Phase;
  statuses: Option[];
  priorities: Option[];
  types: Option[];
  issues: GuestIssue[];
}) {
  const [tab, setTab] = useState<"board" | "roadmap">("board");
  const priMap = new Map(priorities.map((p) => [p.key, p]));
  const typeMap = new Map(types.map((t) => [t.key, t]));

  const counts = { todo: 0, in_progress: 0, done: 0, total: issues.length };
  for (const i of issues) {
    if (i.status === "done") counts.done++;
    else if (i.status === "in_progress" || i.status === "in_review") counts.in_progress++;
    else counts.todo++;
  }
  const pctDone = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Guest view · view-only</p>
            <h1 className="text-lg font-bold text-neutral-900">{project.name}</h1>
          </div>
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {(["board", "roadmap"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${tab === t ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-700"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {tab === "board" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statuses.map((s) => {
              const colIssues = issues.filter((i) => i.status === s.key);
              return (
                <div key={s.key} className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color ?? "#9CA3AF" }} />
                      {s.label}
                    </span>
                    <span className="text-[11px] text-neutral-400">{colIssues.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colIssues.map((i) => {
                      const pri = priMap.get(i.priority);
                      const type = typeMap.get(i.type);
                      return (
                        <div key={i.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-2.5">
                          <p className="text-xs font-mono text-neutral-400">{project.key}-{i.number}</p>
                          <p className="mt-0.5 text-sm text-neutral-800">{i.title}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {type && <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-neutral-600">{type.label}</span>}
                            {pri && <span className="rounded px-1.5 py-0.5 text-white" style={{ backgroundColor: pri.color ?? "#9CA3AF" }}>{pri.label}</span>}
                            {i.assigneeName && <span className="ml-auto text-neutral-500">{i.assigneeName}</span>}
                          </div>
                        </div>
                      );
                    })}
                    {colIssues.length === 0 && <p className="text-[11px] text-neutral-300">Empty</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-xl rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-800">Project timeline</h2>
            {phase && (
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: phase.color }} />
                <span className="text-sm text-neutral-700">{phase.name}</span>
                {(phase.start_date || phase.end_date) && (
                  <span className="text-xs text-neutral-400">
                    {phase.start_date ?? "—"} → {phase.end_date ?? "—"}
                  </span>
                )}
              </div>
            )}
            {!phase && <p className="mt-3 text-sm text-neutral-400">No phase assigned yet.</p>}
            {project.targetGoLive && (
              <p className="mt-3 text-sm text-neutral-600">Target go-live: <span className="font-medium text-neutral-900">{project.targetGoLive}</span></p>
            )}
            <div className="mt-5">
              <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
                <span>Progress</span>
                <span>{pctDone}% done · {counts.done}/{counts.total} issues</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pctDone}%` }} />
              </div>
              <div className="mt-3 flex gap-4 text-xs text-neutral-500">
                <span>{counts.todo} to do</span>
                <span>{counts.in_progress} in progress</span>
                <span>{counts.done} done</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
