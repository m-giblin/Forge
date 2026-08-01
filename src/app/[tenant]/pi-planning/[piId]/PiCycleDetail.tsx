"use client";

import { useMemo, useState, useTransition } from "react";
import { addPiObjectiveAction, deletePiObjectiveAction, castPiVoteAction } from "../actions";
import PageHeader from "@/components/patterns/PageHeader";
import SectionGroup from "@/components/patterns/SectionGroup";
import StatCard from "@/components/patterns/StatCard";

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
            n <= value ? "border-[#b7452f] bg-[#b7452f]" : "border-[#ddd8c9] bg-white"
          } ${readOnly ? "cursor-default" : "cursor-pointer hover:border-[#b7452f]"}`}
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

  const overallAvg = useMemo(() => {
    if (votes.length === 0) return null;
    return votes.reduce((s, v) => s + v.score, 0) / votes.length;
  }, [votes]);

  const teamsRepresented = useMemo(() => {
    const s = new Set<string>();
    for (const o of objectives) if (o.projectId) s.add(o.projectId);
    return s.size;
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
    <div>
      <PageHeader
        title={cycle.name}
        subtitle={`${cycle.startDate} → ${cycle.endDate} · ${cycle.status}`}
        right={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[5px] border border-[#5e2c1f] px-4 py-2 text-[12px] font-semibold text-[#f2e9d8]"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              + Add objective
            </button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-5">
        {error && <p className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</p>}

        {objectives.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Objectives" value={objectives.length} hint={teamsRepresented > 0 ? `across ${teamsRepresented} teams` : undefined} />
            <StatCard label="Avg confidence" value={overallAvg != null ? overallAvg.toFixed(1) : "—"} hint="of 5" />
            <StatCard label="Votes cast" value={votes.length} />
          </div>
        )}

        {showForm && (
          <div className="fw-card px-4 py-4">
            <h3 className="mb-3 text-[13px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">New objective</h3>
            <div className="space-y-2">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Objective title"
                className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full resize-none rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]"
              />
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-[5px] border border-[#ddd8c9] bg-white px-2 py-2 text-[12.5px] text-[#20201d]"
              >
                <option value="">No specific team</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={addObjective}
                disabled={pending || !title.trim()}
                className="rounded-[5px] border border-[#5e2c1f] px-4 py-2 text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                Add
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-[5px] px-4 py-2 text-[12px] font-semibold text-[#a19d90] hover:bg-[#eae6da]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {objectives.length === 0 && !showForm && (
          <p className="text-[12.5px] text-[#a19d90]">No objectives yet — add one for each team&apos;s commitment this increment.</p>
        )}

        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([key, objs]) => (
            <SectionGroup
              key={key}
              label={key === "__none__" ? "Cross-cutting" : projectMap.get(key)?.name ?? "Unknown team"}
              color="#8c4632"
              count={objs.length}
            >
              {objs.map((o, i) => {
                const objVotes = votesByObjective.get(o.id) ?? [];
                const avg = objVotes.length ? objVotes.reduce((s, v) => s + v.score, 0) / objVotes.length : null;
                const myVote = objVotes.find((v) => v.userId === meUserId)?.score ?? 0;
                return (
                  <div key={o.id} className={`px-3.5 py-3 ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-[#20201d]">{o.title}</p>
                        {o.description && <p className="mt-0.5 text-[11.5px] text-[#726e60]">{o.description}</p>}
                      </div>
                      <button
                        onClick={() => removeObjective(o.id)}
                        disabled={pending}
                        className="shrink-0 text-[11px] font-semibold text-[#c0392b] hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-[#e3ded0] pt-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#726e60]">Your confidence:</span>
                        <ConfidenceDots value={myVote} onRate={(score) => vote(o.id, score)} />
                      </div>
                      <span className="text-[11px] text-[#a19d90]">
                        {avg != null ? `Avg ${avg.toFixed(1)}/5 · ${objVotes.length} vote${objVotes.length === 1 ? "" : "s"}` : "No votes yet"}
                      </span>
                    </div>
                    {objVotes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {objVotes.map((v) => (
                          <span key={v.userId} className="text-[11px] text-[#a19d90]">{memberMap.get(v.userId) ?? "?"}: {v.score}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </SectionGroup>
          ))}
        </div>
      </div>
    </div>
  );
}
