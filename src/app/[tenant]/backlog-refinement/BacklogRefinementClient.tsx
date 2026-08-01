"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIssueAction } from "../issues/[id]/actions";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminList from "@/components/patterns/admin/AdminList";

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
  const upNext = issues.slice(index + 1, index + 4);

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
    <div>
      <PageHeader
        title="Backlog Refinement"
        subtitle="One card at a time — estimate, prioritize, mark ready"
        right={
          <select
            value={projectId}
            onChange={(e) => switchProject(e.target.value)}
            className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[11.5px] font-semibold text-[#4a473e] outline-none focus:border-[#b7452f]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        }
      />

      <div className="mx-auto max-w-2xl space-y-5 px-6 py-5">
        <StatsRow
          items={[
            { label: "Refined today", value: refinedCount, hint: `of ${totalStarted} queued` },
            { label: "Remaining", value: Math.max(0, totalStarted - index), hint: "in this session" },
            { label: "Avg points", value: current?.storyPoints ?? "—", hint: "this session" },
            { label: "Project", value: project?.key ?? "—", hint: project?.name ?? "" },
          ]}
        />

        {!backlogStatus && (
          <div className="fw-card px-6 py-10 text-center text-[12.5px] text-[#a19d90]">
            This workspace has no statuses configured.
          </div>
        )}

        {backlogStatus && totalStarted === 0 && (
          <div className="fw-card px-6 py-10 text-center text-[12.5px] text-[#a19d90]">
            Nothing in {backlogStatus.label} for this project — you&apos;re all refined.
          </div>
        )}

        {backlogStatus && totalStarted > 0 && !current && (
          <div className="rounded-[6px] border border-[#c9d9c9] bg-[#e9f3ea] px-6 py-10 text-center">
            <p className="text-[15px] font-extrabold font-[family-name:var(--font-manrope)] text-[#3f7d4c]">Session complete 🎉</p>
            <p className="mt-1 text-[12.5px] text-[#3f7d4c]">Refined {refinedCount} of {totalStarted} issues.</p>
          </div>
        )}

        {current && (
          <>
            <div className="fw-card px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] text-[#a19d90]">
                <span className="font-mono">{project?.key}-{current.number}</span>
                <span className="rounded bg-[#e3ded0] px-1.5 py-0.5">{typeMap.get(current.type) ?? current.type}</span>
                {priMap.get(current.priority) && (
                  <span className="rounded px-1.5 py-0.5 font-semibold text-white" style={{ backgroundColor: priMap.get(current.priority)!.color ?? "#a19d90" }}>
                    {priMap.get(current.priority)!.label}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-[15px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">{current.title}</h2>
              {current.description && (
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[12.5px] text-[#4a473e]">{current.description}</p>
              )}

              <div className="mt-5">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Story points</p>
                <div className="flex flex-wrap items-center gap-2">
                  {QUICK_POINTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPoints(String(p))}
                      className={`rounded-[5px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                        points === String(p) ? "border-[#8c4632] bg-[#f3e4dd] text-[#8c4632]" : "border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#eae6da]"
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
                    className="w-24 rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] outline-none focus:border-[#b7452f]"
                  />
                  {current.storyPoints != null && (
                    <span className="text-[11px] text-[#a19d90]">currently {current.storyPoints}</span>
                  )}
                </div>
              </div>

              {error && <p className="mt-3 text-[12px] text-[#c0392b]">{error}</p>}

              <div className="mt-6 flex gap-2">
                <button
                  onClick={markReady}
                  disabled={pending || !readyStatus}
                  className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                  style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
                >
                  {pending ? "Saving…" : `Mark ready → ${readyStatus?.label ?? ""}`}
                </button>
                <button
                  onClick={skip}
                  disabled={pending}
                  className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            </div>

            {upNext.length > 0 && (
              <div>
                <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Up next</p>
                <AdminList
                  items={upNext.map((i, idx) => ({
                    key: i.id,
                    title: `${project?.key}-${i.number} · ${i.title}`,
                    subline: idx === 0 ? "Next in queue" : "Queued",
                    meta: `${typeMap.get(i.type) ?? i.type} · ${priMap.get(i.priority)?.label ?? i.priority}`,
                  }))}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
