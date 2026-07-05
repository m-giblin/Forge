"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Issue } from "@/lib/repositories/issues";
import { type Sprint } from "@/lib/repositories/sprints";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { isUnassignedOverdue } from "@/lib/sla";
import { createIssueAction, moveIssueAction, loadMoreForStatusAction, draftIssueFromDescriptionAction } from "./actions";
import { cascadeStatusToChildrenAction } from "../issues/[id]/actions";
import IssueCard from "./IssueCard";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };

const AVATAR_COLORS = ["#6366F1","#8B5CF6","#EC4899","#14B8A6","#F59E0B","#10B981","#3B82F6","#F97316"];
function avatarColor(userId: string): string {
  const code = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}
function initials(label: string): string {
  return label.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

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
  // per-status: how many issues are loaded and whether more exist
  const [colOffsets, setColOffsets] = useState<Map<string, number>>(new Map());
  const [colHasMore, setColHasMore] = useState<Map<string, boolean>>(new Map());
  const [loadingMore, setLoadingMore] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterPriorities, setFilterPriorities] = useState<Set<string>>(new Set());
  const [filterAssignee, setFilterAssignee] = useState("");
  const [presentUsers, setPresentUsers] = useState<Array<{ userId: string; label: string }>>([]);
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // groupBy persisted in URL (?groupBy=status|assignee|priority)
  const groupByParam = (searchParams.get("groupBy") ?? "status") as "status" | "assignee" | "priority";
  const groupBy = ["status", "assignee", "priority"].includes(groupByParam) ? groupByParam : "status";
  function setGroupBy(value: "status" | "assignee" | "priority") {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "status") next.delete("groupBy");
    else next.set("groupBy", value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const projectKey = (id: string) => projects.find((p) => p.id === id)?.key ?? "—";
  // Config-driven lookups (key → option) for labels/colors on cards.
  const prMap = useMemo(() => new Map(priorities.map((o) => [o.key, o])), [priorities]);
  const tyMap = useMemo(() => new Map(types.map((o) => [o.key, o])), [types]);
  const memMap = useMemo(() => new Map(members.map((m) => [m.userId, m.label])), [members]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const orderedStatuses = useMemo(() => [...statuses].sort((a, b) => a.position - b.position), [statuses]);
  // Tickets sitting unassigned past their SLA grace period (30m urgent / 2h else).
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

  // Realtime: subscribe to this tenant's issue changes. RLS applies to the
  // subscription, so the socket MUST carry the user's JWT — otherwise the
  // server filters out every event for the RLS-protected table.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      // Resolve current user label for presence tracking
      const meLabel = meUserId
        ? (members.find((m) => m.userId === meUserId)?.label ?? "You")
        : "You";

      channel = supabase
        .channel(`board:${tenantId}:${currentProject.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "issues", filter: `tenant_id=eq.${tenantId}` },
          (payload) => {
            if (payload.eventType === "DELETE") remove((payload.old as { id: string }).id);
            else {
              const row = payload.new as Issue;
              // Board is scoped to one project — ignore other projects' events.
              if (row.project_id === currentProject.id) upsert(row);
            }
          }
        )
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{ userId: string; label: string }>();
          const others = Object.values(state)
            .flat()
            .filter((p) => p.userId !== meUserId)
            .reduce<Array<{ userId: string; label: string }>>((acc, p) => {
              if (!acc.find((x) => x.userId === p.userId)) acc.push({ userId: p.userId, label: p.label });
              return acc;
            }, []);
          setPresentUsers(others);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && meUserId) {
            await channel!.track({ userId: meUserId, label: meLabel });
          }
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [tenantId, currentProject.id]);

  function onDrop(status: string) {
    if (!canEdit || !dragId) return;
    const id = dragId;
    setDragId(null);
    const current = issues.find((x) => x.id === id);
    if (!current || current.status === status) return;
    upsert({ ...current, status }); // optimistic
    startTransition(async () => {
      try {
        const { pendingChildCount } = await moveIssueAction(slug, id, status);
        if (pendingChildCount > 0) {
          setCascadePending({ issueId: id, newStatus: status, count: pendingChildCount });
        }
      } catch {
        upsert(current); // revert on failure
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

  // Velocity: count of done issues in the currently selected sprint
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
          {/* Presence: who else is viewing this board */}
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

      <div className="mb-4 space-y-2">
        {/* Row 1: search + group-by */}
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "status" | "assignee" | "priority")}
            className="rounded-lg border border-neutral-300 px-2 py-2 text-sm text-neutral-600 shrink-0"
          >
            <option value="status">By Status</option>
            <option value="assignee">By Assignee</option>
            <option value="priority">By Priority</option>
          </select>
        </div>
        {/* Row 2: filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-600"
          >
            <option value="">All assignees</option>
            <option value="__unassigned">Unassigned</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-600"
          >
            <option value="">All types</option>
            {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-600"
            >
              <option value="">All categories</option>
              {categories.filter((c) => !c.parent_id).flatMap((top) => [
                <option key={top.id} value={top.id}>{top.name}</option>,
                ...categories.filter((c) => c.parent_id === top.id).map((sub) => (
                  <option key={sub.id} value={sub.id}>— {sub.name}</option>
                )),
              ])}
            </select>
          )}
          {priorities.map((p) => {
            const active = filterPriorities.has(p.key);
            return (
              <button
                key={p.key}
                onClick={() => setFilterPriorities((prev) => {
                  const next = new Set(prev);
                  active ? next.delete(p.key) : next.add(p.key);
                  return next;
                })}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "white" : (p.color ?? "#9CA3AF") }} />
                {p.label}
              </button>
            );
          })}
        </div>
        {(search || filterPriorities.size > 0 || filterAssignee || filterType || filterCategory) && (
          <button
            onClick={() => { setSearch(""); setFilterPriorities(new Set()); setFilterAssignee(""); setFilterType(""); setFilterCategory(""); }}
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            Clear
          </button>
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
                <IssueCardList issues={colIssues} canEdit={false} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={(id) => router.push(`/${slug}/issues/${id}`)} projectKey={projectKey} showAssignee />
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
              <IssueCardList issues={colIssues} canEdit={canEdit} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={(id) => router.push(`/${slug}/issues/${id}`)} projectKey={projectKey} showAssignee />
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
              <IssueCardList issues={col.issues} canEdit={false} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={(id) => router.push(`/${slug}/issues/${id}`)} projectKey={projectKey} showAssignee={false} />
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
        />
      ))}
    </div>
  );
}

function defaultKey(opts: FieldOption[]): string {
  return (opts.find((o) => o.is_default) ?? opts[0])?.key ?? "";
}

function NewIssueForm({
  slug,
  projects,
  priorities,
  types,
  categories,
  customFields,
  sprints,
  onCreated,
}: {
  slug: string;
  projects: Project[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  sprints: Sprint[];
  onCreated: (issue: Issue) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState(defaultKey(priorities));
  const [type, setType] = useState(defaultKey(types));
  const [categoryId, setCategoryId] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [sprintId, setSprintId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiMode, setAiMode] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  function startVoice() {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Voice input not supported in this browser."); return; }
    const rec = new (SpeechRecognition as new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void })();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    setVoiceListening(true);
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ");
      setAiDescription(transcript);
      setAiMode(true);
      setVoiceListening(false);
    };
    rec.onerror = () => setVoiceListening(false);
    rec.onend = () => setVoiceListening(false);
    rec.start();
  }

  function draftWithAI() {
    if (!aiDescription.trim()) return;
    setAiPending(true);
    startTransition(async () => {
      try {
        const draft = await draftIssueFromDescriptionAction(slug, aiDescription);
        setTitle(draft.title);
        setPriority(draft.priority);
        setType(draft.type);
        setAiMode(false);
        setAiDescription("");
      } catch {
        setError("AI draft failed — try typing the title manually.");
      } finally {
        setAiPending(false);
      }
    });
  }

  // Categories rendered as flat options with sub-categories indented.
  const tops = categories.filter((c) => !c.parent_id);
  const catOptions = tops.flatMap((t) => [
    { id: t.id, label: t.name },
    ...categories.filter((c) => c.parent_id === t.id).map((s) => ({ id: s.id, label: `— ${s.name}` })),
  ]);

  function submit() {
    if (!title.trim() || !projectId) return;
    setError(null);
    startTransition(async () => {
      try {
        const customValues = Object.fromEntries(
          Object.entries(custom).filter(([, v]) => v !== "" && v != null)
        );
        const issue = await createIssueAction(slug, {
          projectId,
          title: title.trim(),
          priority,
          type,
          categoryId: categoryId || null,
          customValues,
          sprintId: sprintId || null,
        });
        setTitle("");
        setCustom({});
        onCreated(issue);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });
  }

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      {/* Quick templates */}
      {showTemplates && (
        <div className="mb-3 pb-3 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-500 mb-2">Quick templates</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "🐛 Bug report", title: "[Bug] ", type: "bug", priority: "high" },
              { label: "✨ Feature request", title: "[Feature] ", type: "feature", priority: "medium" },
              { label: "⚙️ Tech debt", title: "[Debt] ", type: "task", priority: "low" },
              { label: "🔒 Security issue", title: "[Security] ", type: "bug", priority: "urgent" },
              { label: "📋 Task", title: "", type: "task", priority: "medium" },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setTitle(t.title);
                  const matchType = types.find((x) => x.key === t.type);
                  if (matchType) setType(matchType.key);
                  const matchPri = priorities.find((x) => x.key === t.priority);
                  if (matchPri) setPriority(matchPri.key);
                  setShowTemplates(false);
                }}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* AI Draft mode */}
      {aiMode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-600">✨ Describe the issue in plain English</p>
            <button onClick={() => setAiMode(false)} className="text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
          </div>
          <textarea
            autoFocus
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            placeholder="e.g. The login button on mobile doesn't work when the keyboard is open — it gets pushed off screen and clicking elsewhere closes the keyboard..."
            rows={3}
            className="w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={draftWithAI}
              disabled={aiPending || !aiDescription.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {aiPending ? "Drafting…" : "Generate fields →"}
            </button>
            <button onClick={() => setAiMode(false)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
              Manual
            </button>
          </div>
        </div>
      ) : (
      <div className="space-y-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Issue title…"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <div className="flex flex-wrap gap-2">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.key}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          {types.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          {priorities.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        {catOptions.length > 0 && (
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
            <option value="">No category</option>
            {catOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        )}
        {sprints.length > 0 && (
          <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
            <option value="">No sprint</option>
            {sprints.filter((s) => s.status !== "completed").map((s) => (
              <option key={s.id} value={s.id}>
                {s.status === "active" ? "▶ " : "○ "}{s.name}
              </option>
            ))}
          </select>
        )}
        </div>
        <button
          onClick={submit}
          disabled={pending || !title.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          onClick={() => setShowTemplates((s) => !s)}
          type="button"
          title="Start from a template"
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showTemplates ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}
        >
          📋 Templates
        </button>
        <button
          onClick={() => { setAiMode(true); setError(null); }}
          type="button"
          title="Describe the issue in plain English and let AI fill the fields"
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          ✨ AI Draft
        </button>
        <button
          onClick={startVoice}
          type="button"
          title="Dictate issue via microphone"
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${voiceListening ? "border-red-300 bg-red-50 text-red-600 animate-pulse" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}
        >
          {voiceListening ? "🎙 Listening…" : "🎙 Voice"}
        </button>
      </div>
      )}

      {customFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-neutral-100 pt-3">
          {customFields.map((f) => (
            <label key={f.id} className="flex flex-col gap-1 text-xs text-neutral-500">
              {f.label}
              {f.type === "select" ? (
                <select
                  value={custom[f.key] ?? ""}
                  onChange={(e) => setCustom((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800"
                >
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={custom[f.key] ?? ""}
                  onChange={(e) => setCustom((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800"
                />
              )}
            </label>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
