"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { type Issue } from "@/lib/repositories/issues";
import { type Sprint } from "@/lib/repositories/sprints";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { isUnassignedOverdue } from "@/lib/sla";
import { avatarColor, initials } from "@/lib/ui/avatar";
import { moveIssueAction, loadMoreForStatusAction } from "./actions";
import { cascadeStatusToChildrenAction } from "../issues/[id]/actions";
import IssueCard from "./IssueCard";
import NewIssueForm from "./NewIssueForm";
import BoardFilters from "./BoardFilters";
import { useBoardRealtime } from "./useBoardRealtime";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };

export default function Board({
  slug,
  tenantId,
  role,
  currentProject,
  siblingProjects,
  initialIssues,
  total,
  issueLimit,
  projects,
  statuses,
  priorities,
  types,
  categories,
  customFields,
  members,
  sprints,
  currentSprint,
  meUserId,
}: {
  slug: string;
  tenantId: string;
  role: string;
  currentProject: Project;
  siblingProjects: Project[];
  initialIssues: Issue[];
  total: number;
  issueLimit: number;
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  members: Member[];
  sprints: Sprint[];
  currentSprint: Sprint | null;
  meUserId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = role !== "viewer";
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();
  const [cascadePending, setCascadePending] = useState<{ issueId: string; newStatus: string; count: number } | null>(null);
  const [cascading, startCascade] = useTransition();
  const [colOffsets, setColOffsets] = useState<Map<string, number>>(new Map());
  const [colHasMore, setColHasMore] = useState<Map<string, boolean>>(new Map());
  const [loadingMore, setLoadingMore] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterPriorities, setFilterPriorities] = useState<Set<string>>(new Set());
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showAging, setShowAging] = useState(false);

  const groupByParam = (searchParams.get("groupBy") ?? "status") as "status" | "assignee" | "priority";
  const groupBy = ["status", "assignee", "priority"].includes(groupByParam) ? groupByParam : "status";
  function setGroupBy(value: "status" | "assignee" | "priority") {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "status") next.delete("groupBy");
    else next.set("groupBy", value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const projectKey = (id: string) => projects.find((p) => p.id === id)?.key ?? "—";
  const prMap = useMemo(() => new Map(priorities.map((o) => [o.key, o])), [priorities]);
  const tyMap = useMemo(() => new Map(types.map((o) => [o.key, o])), [types]);
  const memMap = useMemo(() => new Map(members.map((m) => [m.userId, m.label])), [members]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const orderedStatuses = useMemo(() => [...statuses].sort((a, b) => a.position - b.position), [statuses]);
  const needsAssignment = useMemo(() => issues.filter((i) => isUnassignedOverdue(i)), [issues]);

  const filtered = useMemo(() => {
    let list = issues;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        `${projectKey(i.project_id)}-${i.number}`.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.assignee_id ? (memMap.get(i.assignee_id) ?? "").toLowerCase().includes(q) : false)
      );
    }
    if (filterPriorities.size > 0) list = list.filter((i) => filterPriorities.has(i.priority));
    if (filterAssignee === "__unassigned") list = list.filter((i) => !i.assignee_id);
    else if (filterAssignee) list = list.filter((i) => i.assignee_id === filterAssignee);
    if (filterType) list = list.filter((i) => i.type === filterType);
    if (filterCategory) list = list.filter((i) => i.category_id === filterCategory);
    return list;
  }, [issues, search, filterPriorities, filterAssignee, filterType, filterCategory, memMap]);

  const upsert = (row: Issue) =>
    setIssues((prev) => {
      const i = prev.findIndex((x) => x.id === row.id);
      if (i === -1) return [...prev, row];
      const next = [...prev];
      next[i] = { ...next[i], ...row };
      return next;
    });
  const remove = (id: string) => setIssues((prev) => prev.filter((x) => x.id !== id));

  const { presentUsers } = useBoardRealtime({
    tenantId,
    projectId: currentProject.id,
    meUserId,
    members,
    onUpsert: upsert,
    onRemove: remove,
  });

  function onDrop(status: string) {
    if (!canEdit || !dragId) return;
    const id = dragId;
    setDragId(null);
    const current = issues.find((x) => x.id === id);
    if (!current || current.status === status) return;
    upsert({ ...current, status });
    startTransition(async () => {
      try {
        const { pendingChildCount } = await moveIssueAction(slug, id, status);
        if (pendingChildCount > 0) {
          setCascadePending({ issueId: id, newStatus: status, count: pendingChildCount });
        }
      } catch {
        upsert(current);
      }
    });
  }

  function confirmCascade(yes: boolean) {
    if (!cascadePending) return;
    const { issueId, newStatus, count } = cascadePending;
    setCascadePending(null);
    if (!yes || count === 0) return;
    startCascade(async () => {
      await cascadeStatusToChildrenAction(slug, issueId, newStatus);
    });
  }

  async function loadMore(status: string) {
    const offset = colOffsets.get(status) ?? issues.filter((i) => i.status === status).length;
    setLoadingMore((prev) => new Set(prev).add(status));
    try {
      const { issues: more, hasMore } = await loadMoreForStatusAction(slug, currentProject.id, status, offset);
      if (more.length > 0) {
        setIssues((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          return [...prev, ...more.filter((i) => !existingIds.has(i.id))];
        });
        setColOffsets((prev) => new Map(prev).set(status, offset + more.length));
        setColHasMore((prev) => new Map(prev).set(status, hasMore));
      } else {
        setColHasMore((prev) => new Map(prev).set(status, false));
      }
    } finally {
      setLoadingMore((prev) => { const next = new Set(prev); next.delete(status); return next; });
    }
  }

  const sprintDoneCount = currentSprint
    ? initialIssues.filter((i) => i.sprint_id === currentSprint.id && i.status === "done").length
    : null;

  function selectSprint(sprintId: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (sprintId) next.set("sprint", sprintId);
    else next.delete("sprint");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div>
      {sprints.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => selectSprint(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !currentSprint
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
            }`}
          >
            All Sprints
          </button>
          {sprints.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSprint(s.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                currentSprint?.id === s.id
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {s.name}
              {s.status === "active" && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-400 align-middle" />
              )}
            </button>
          ))}
          {currentSprint && sprintDoneCount !== null && (
            <span className="ml-1 text-xs text-neutral-400">
              {sprintDoneCount} done this sprint
            </span>
          )}
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/projects/${currentProject.key}`}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-600 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Projects
          </Link>
          <span className="text-neutral-300">/</span>
          <Link
            href={`/${slug}/projects/${currentProject.key}`}
            className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            {currentProject.key}
          </Link>
          <h1 className="text-lg font-semibold text-neutral-900">{currentProject.name}</h1>
          {siblingProjects.length > 1 && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-neutral-400">Project</label>
              <select
                value={currentProject.key}
                onChange={(e) => router.push(`/${slug}/board?project=${e.target.value}`)}
                className="rounded-lg border-2 border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-sm font-medium text-indigo-700 shadow-sm focus:border-indigo-500 focus:outline-none"
                aria-label="Switch project"
              >
                {siblingProjects.map((p) => (
                  <option key={p.id} value={p.key}>
                    {p.key} — {p.name}
                  </option>
                ))}
              </select>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                {siblingProjects.length}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {presentUsers.length > 0 && (
            <div className="flex items-center" title={presentUsers.map((u) => u.label).join(", ")}>
              {presentUsers.slice(0, 5).map((u, i) => (
                <div
                  key={u.userId}
                  title={u.label}
                  style={{
                    backgroundColor: avatarColor(u.userId),
                    marginLeft: i > 0 ? "-6px" : "0",
                    zIndex: 10 - i,
                  }}
                  className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-sm"
                >
                  {initials(u.label)}
                </div>
              ))}
              {presentUsers.length > 5 && (
                <div
                  style={{ marginLeft: "-6px", zIndex: 5 }}
                  className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-[10px] font-semibold text-neutral-600"
                >
                  +{presentUsers.length - 5}
                </div>
              )}
              <span className="ml-2 text-xs text-neutral-400">
                {presentUsers.length === 1 ? "1 other viewing" : `${presentUsers.length} others viewing`}
              </span>
            </div>
          )}
          {canEdit && (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {showForm ? "Close" : "+ New issue"}
            </button>
          )}
        </div>
      </div>

      {needsAssignment.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-medium">{needsAssignment.length}</span>
          <span>
            ticket{needsAssignment.length > 1 ? "s" : ""} unassigned past SLA —
          </span>
          <button
            onClick={() => router.push(`/${slug}/issues/${needsAssignment[0].id}`)}
            className="font-medium underline hover:no-underline"
          >
            review oldest
          </button>
        </div>
      )}

      {total > issueLimit && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Showing {issueLimit} of {total} issues — use the &ldquo;Load more&rdquo; button in each column to see the rest.
        </div>
      )}

      {cascadePending && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>
            This issue has <strong>{cascadePending.count}</strong> sub-issue{cascadePending.count !== 1 ? "s" : ""} not yet in <strong>{cascadePending.newStatus}</strong>. Move them too?
          </span>
          <div className="ml-4 flex shrink-0 gap-2">
            <button
              onClick={() => confirmCascade(true)}
              disabled={cascading}
              className="rounded-md bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {cascading ? "Moving…" : "Yes, move all"}
            </button>
            <button
              onClick={() => confirmCascade(false)}
              className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      <BoardFilters
        search={search}
        setSearch={setSearch}
        filterPriorities={filterPriorities}
        setFilterPriorities={setFilterPriorities}
        filterAssignee={filterAssignee}
        setFilterAssignee={setFilterAssignee}
        filterType={filterType}
        setFilterType={setFilterType}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        priorities={priorities}
        types={types}
        categories={categories}
        members={members}
      />
      <div className="flex items-center gap-2 px-4">
        <button
          onClick={() => setShowAging((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            showAging
              ? "border-orange-300 bg-orange-50 text-orange-700"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
          }`}
          title="Highlight issues by days since last update"
        >
          <span>🔥</span> Aging {showAging ? "On" : "Off"}
        </button>
        {showAging && (
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-400" /> &lt;4d</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-400" /> 4–7d</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-400" /> 8–14d</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> 15d+</span>
          </div>
        )}
      </div>

      {showForm && (
        <NewIssueForm
          slug={slug}
          projects={[currentProject]}
          priorities={priorities}
          types={types}
          categories={categories}
          customFields={customFields}
          sprints={sprints}
          members={members}
          onCreated={(issue) => {
            upsert(issue);
            setShowForm(false);
          }}
        />
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {groupBy === "priority" ? (() => {
          const orderedPriorities = [...priorities].sort((a, b) => a.position - b.position);
          return orderedPriorities.map((p) => {
            const colIssues = filtered.filter((i) => i.priority === p.key).sort((a, b) => a.position - b.position);
            if (colIssues.length === 0) return null;
            return (
              <div key={p.key} className="flex w-56 min-w-[200px] shrink-0 flex-col rounded-xl bg-neutral-100/70 p-3 md:w-64">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                    {p.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />}
                    {p.label}
                  </span>
                  <span className="text-xs text-neutral-400">{colIssues.length}</span>
                </div>
                <IssueCardList issues={colIssues} canEdit={false} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={(id) => router.push(`/${slug}/issues/${id}`)} projectKey={projectKey} showAssignee showAging={showAging} />
              </div>
            );
          });
        })() : groupBy === "status" ? orderedStatuses.map((status) => {
          const colIssues = filtered
            .filter((i) => i.status === status.key)
            .sort((a, b) => a.position - b.position);
          const isFiltered = !!(search.trim() || filterPriorities.size > 0 || filterAssignee || filterType || filterCategory);
          const showLoadMore = !isFiltered && (colHasMore.get(status.key) ?? (total > issueLimit && colIssues.length >= Math.floor(issueLimit / orderedStatuses.length)));
          return (
            <div
              key={status.key}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => onDrop(status.key)}
              className="flex w-56 min-w-[200px] shrink-0 flex-col rounded-xl bg-neutral-100/70 p-3 md:w-64"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  {status.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />}
                  {status.label}
                </span>
                <span className="text-xs text-neutral-400">{colIssues.length}</span>
              </div>
              <IssueCardList issues={colIssues} canEdit={canEdit} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={(id) => router.push(`/${slug}/issues/${id}`)} projectKey={projectKey} showAssignee showAging={showAging} />
              {showLoadMore && (
                <button
                  onClick={() => loadMore(status.key)}
                  disabled={loadingMore.has(status.key)}
                  className="mt-2 w-full rounded-lg border border-dashed border-neutral-300 py-1.5 text-xs text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 disabled:opacity-50 transition-colors"
                >
                  {loadingMore.has(status.key) ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          );
        }) : groupBy === "assignee" ? (() => {
          const unassigned = filtered.filter((i) => !i.assignee_id);
          const assigneeCols = members
            .map((m) => ({ member: m, issues: filtered.filter((i) => i.assignee_id === m.userId) }))
            .filter((col) => col.issues.length > 0);
          const cols = [
            ...(unassigned.length > 0 ? [{ key: "__unassigned", label: "Unassigned", color: "#9CA3AF", issues: unassigned }] : []),
            ...assigneeCols.map((col) => ({ key: col.member.userId, label: col.member.label, color: avatarColor(col.member.userId), issues: col.issues })),
          ];
          return cols.map((col) => (
            <div key={col.key} className="flex w-56 min-w-[200px] shrink-0 flex-col rounded-xl bg-neutral-100/70 p-3 md:w-64">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ backgroundColor: col.color }}>
                    {col.key === "__unassigned" ? "?" : initials(col.label)}
                  </span>
                  {col.label}
                </span>
                <span className="text-xs text-neutral-400">{col.issues.length}</span>
              </div>
              <IssueCardList issues={col.issues} canEdit={false} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={(id) => router.push(`/${slug}/issues/${id}`)} projectKey={projectKey} showAssignee={false} showAging={showAging} />
            </div>
          ));
        })() : null}
      </div>
    </div>
  );
}

function IssueCardList({
  issues,
  canEdit,
  slug,
  tyMap,
  prMap,
  memMap,
  catMap,
  onDragStart,
  onClickIssue,
  projectKey,
  showAssignee,
  showAging = false,
}: {
  issues: Issue[];
  canEdit: boolean;
  slug: string;
  tyMap: Map<string, FieldOption>;
  prMap: Map<string, FieldOption>;
  memMap: Map<string, string>;
  catMap: Map<string, string>;
  onDragStart: (id: string) => void;
  onClickIssue: (id: string) => void;
  projectKey: (projectId: string) => string;
  showAssignee: boolean;
  showAging?: boolean;
}) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-xs text-neutral-400">
        None
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          slug={slug}
          canEdit={canEdit}
          tyMap={tyMap}
          prMap={prMap}
          memMap={memMap}
          catMap={catMap}
          onDragStart={() => onDragStart(issue.id)}
          onClickIssue={() => onClickIssue(issue.id)}
          projectKey={`${projectKey(issue.project_id)}`}
          showAssignee={showAssignee}
          showAging={showAging}
        />
      ))}
    </div>
  );
}
