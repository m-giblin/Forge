"use client";

import { useMemo, useState, useTransition } from "react";
import { addPiObjectiveAction, deletePiObjectiveAction, castPiVoteAction } from "../actions";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };
type Objective = { id: string; title: string; description: string | null; projectId: string | null };
type Vote = { objectiveId: string; userId: string; score: number };

function ConfidenceDots({ value, onRate, readOnly }: { value: number; onRate?: (score: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onRate?.(n)}
          className={`h-3.5 w-3.5 rounded-full border transition-colors ${
            n <= value ? "border-amber-400 bg-amber-400" : "border-neutral-300 bg-white"
          } ${readOnly ? "cursor-default" : "cursor-pointer hover:border-amber-400"}`}
          title={`${n}`}
        />
      ))}
    </div>
  );
}

export default function PiCycleDetail({
  slug, meUserId, cycle, projects, members, objectives: initialObjectives, votes: initialVotes,
}: {
  slug: string; meUserId: string;
  cycle: { id: string; name: string; startDate: string; endDate: string; status: string };
  projects: Project[]; members: Member[]; objectives: Objective[]; votes: Vote[];
}) {
  const [objectives, setObjectives] = useState(initialObjectives);
  const [votes, setVotes] = useState(initialVotes);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.userId, m.label])), [members]);

  const votesByObjective = useMemo(() => {
    const m = new Map<string, Vote[]>();
    for (const v of votes) {
      const list = m.get(v.objectiveId) ?? [];
      list.push(v);
      m.set(v.objectiveId, list);
    }
    return m;
  }, [votes]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Objective[]>();
    for (const o of objectives) {
      const key = o.projectId ?? "__none__";
      const list = groups.get(key) ?? [];
      list.push(o);
      groups.set(key, list);
    }
    return groups;
  }, [objectives]);

  function addObjective() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const obj = await addPiObjectiveAction(slug, cycle.id, title.trim(), description, projectId || null);
        setObjectives((o) => [...o, { id: obj.id, title: obj.title, description: obj.description, projectId: obj.projectId }]);
        setTitle(""); setDescription(""); setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add objective");
      }
    });
  }

  function removeObjective(id: string) {
    startTransition(async () => {
      try {
        await deletePiObjectiveAction(slug, cycle.id, id);
        setObjectives((o) => o.filter((x) => x.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete objective");
      }
    });
  }

  function vote(objectiveId: string, score: number) {
    setError(null);
    startTransition(async () => {
      try {
        await castPiVoteAction(slug, cycle.id, objectiveId, score);
        setVotes((v) => [...v.filter((x) => !(x.objectiveId === objectiveId && x.userId === meUserId)), { objectiveId, userId: meUserId, score }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to vote");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">{cycle.name}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{cycle.startDate} → {cycle.endDate} · {cycle.status}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            + Add objective
          </button>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">New objective</h3>
          <div className="space-y-2">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective title" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 resize-none" />
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
              <option value="">No specific team</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={addObjective} disabled={pending || !title.trim()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">Add</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Cancel</button>
          </div>
        </div>
      )}

      {objectives.length === 0 && !showForm && (
        <p className="text-sm text-neutral-400">No objectives yet — add one for each team&apos;s commitment this increment.</p>
      )}

      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([key, objs]) => (
          <div key={key}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {key === "__none__" ? "Cross-cutting" : projectMap.get(key)?.name ?? "Unknown team"}
            </p>
            <div className="space-y-2">
              {objs.map((o) => {
                const objVotes = votesByObjective.get(o.id) ?? [];
                const avg = objVotes.length ? objVotes.reduce((s, v) => s + v.score, 0) / objVotes.length : null;
                const myVote = objVotes.find((v) => v.userId === meUserId)?.score ?? 0;
                return (
                  <div key={o.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-neutral-900">{o.title}</p>
                        {o.description && <p className="mt-1 text-sm text-neutral-500">{o.description}</p>}
                      </div>
                      <button onClick={() => removeObjective(o.id)} disabled={pending} className="shrink-0 text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">Your confidence:</span>
                        <ConfidenceDots value={myVote} onRate={(score) => vote(o.id, score)} />
                      </div>
                      <span className="text-xs text-neutral-400">
                        {avg != null ? `Avg ${avg.toFixed(1)}/5 · ${objVotes.length} vote${objVotes.length === 1 ? "" : "s"}` : "No votes yet"}
                      </span>
                    </div>
                    {objVotes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {objVotes.map((v) => (
                          <span key={v.userId} className="text-[11px] text-neutral-400">{memberMap.get(v.userId) ?? "?"}: {v.score}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
