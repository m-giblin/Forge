"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateIssueAction } from "../issues/[id]/actions";
import PageHeader from "@/components/patterns/PageHeader";
import SectionGroup from "@/components/patterns/SectionGroup";
import ListRow from "@/components/patterns/ListRow";

type Status = { key: string; label: string };
type Option = { key: string; label: string; color?: string | null };
type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };
type Issue = {
  id: string; number: number; title: string; status: string; type: string;
  priority: string; assigneeId: string | null; storyPoints: number | null;
};

// Ember Rust status colors (HANDOFF.md §3) — fallback for tenant-configured
// status keys that don't match the design's named statuses.
const STATUS_DOT: Record<string, string> = {
  backlog: "#a19d90",
  todo: "#3a6ea8",
  in_progress: "#c9791d",
  in_review: "#7a4fa0",
  blocked: "#c0392b",
  done: "#3f7d4c",
};

const TYPE_CHIP: Record<string, { fg: string; bg: string }> = {
  bug: { fg: "#c0392b", bg: "#fbeae8" },
  feature: { fg: "#7a4fa0", bg: "#f4ecfa" },
  task: { fg: "#3a6ea8", bg: "#eaf1f8" },
};

const PRIORITY_FG: Record<string, string> = {
  low: "#a19d90",
  medium: "#3a6ea8",
  high: "#c9791d",
  urgent: "#c0392b",
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

  const totalUnscheduled = issues.length;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Backlog"
        subtitle={`${totalUnscheduled} unscheduled issue${totalUnscheduled === 1 ? "" : "s"}, grouped by where they're stuck${project ? ` · ${project.name}` : ""}`}
        right={
          <>
            <select
              value={projectId}
              onChange={(e) => switchProject(e.target.value)}
              className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Link
              href={`/${slug}/backlog-refinement`}
              className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
            >
              Refinement session
            </Link>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {error && <p className="mb-3 rounded-lg bg-[#fbeae8] px-3 py-2 text-[12.5px] text-[#c0392b]">{error}</p>}

        {statusOptions.length === 0 && (
          <div className="fw-card p-8 text-center text-[12.5px] text-[#726e60]">
            This workspace has no statuses configured.
          </div>
        )}

        {issues.length === 0 && statusOptions.length > 0 && (
          <div className="fw-card p-8 text-center text-[12.5px] text-[#726e60]">
            Nothing unscheduled in {project?.name ?? "this project"} — the backlog is empty.
          </div>
        )}

        <div className="flex max-w-[1000px] flex-col gap-5">
          {statusOptions.map((s) => {
            const group = grouped.get(s.key) ?? [];
            if (group.length === 0) return null;
            const dotColor = STATUS_DOT[s.key] ?? "#a19d90";
            return (
              <SectionGroup key={s.key} label={s.label} color={dotColor} count={group.length} collapsible>
                {group.map((issue, i) => {
                  const type = typeMap.get(issue.type) ?? issue.type;
                  const typeChip = TYPE_CHIP[issue.type] ?? { fg: "#4a473e", bg: "#eae6da" };
                  const pri = priMap.get(issue.priority);
                  const priColor = pri?.color ?? PRIORITY_FG[issue.priority] ?? "#a19d90";
                  return (
                    <ListRow
                      key={issue.id}
                      first={i === 0}
                      issueKey={`${project?.key ?? "?"}-${issue.number}`}
                      title={
                        <Link href={`/${slug}/issues/${issue.id}`} className="hover:underline">
                          {issue.title}
                        </Link>
                      }
                      right={
                        <>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{ color: typeChip.fg, backgroundColor: typeChip.bg }}
                          >
                            {type}
                          </span>
                          {pri && (
                            <span className="shrink-0 text-[11px] font-bold" style={{ color: priColor }}>
                              {pri.label}
                            </span>
                          )}
                          {issue.storyPoints != null && (
                            <span className="shrink-0 text-[11px] font-bold text-[#a19d90]">{issue.storyPoints}pt</span>
                          )}
                          <span className="hidden shrink-0 w-28 truncate text-[11px] text-[#a19d90] sm:block">
                            {issue.assigneeId ? memberMap.get(issue.assigneeId) ?? "?" : "Unassigned"}
                          </span>
                          {issue.status === backlogStatusKey && readyStatus && (
                            <button
                              onClick={() => markReady(issue)}
                              disabled={pendingId === issue.id}
                              className="shrink-0 text-[11px] font-bold text-[#b7452f] hover:underline disabled:opacity-50"
                            >
                              {pendingId === issue.id ? "…" : "Mark ready"}
                            </button>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </SectionGroup>
            );
          })}
        </div>
      </div>
    </div>
  );
}
