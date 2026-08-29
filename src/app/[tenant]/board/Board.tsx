"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { type Issue } from "@/lib/repositories/issues";
import { type Sprint } from "@/lib/repositories/sprints";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { type IssueTemplate } from "@/lib/repositories/issueTemplates";
import { type BoardColumnInfo } from "@/lib/services/issues";
import { avatarColor, initials } from "@/lib/ui/avatar";
import { moveIssueAction, loadMoreForStatusAction } from "./actions";
import { cascadeStatusToChildrenAction } from "../issues/[id]/actions";
import IssueCard from "./IssueCard";
import NewIssueForm from "./NewIssueForm";
import BoardFilters from "./BoardFilters";
import { useBoardRealtime } from "./useBoardRealtime";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string; avatarColor?: string | null };

export default function Board({
  slug,
  tenantId,
  role,
  currentProject,
  siblingProjects,
  initialIssues,
  columnInfo,
  projects,
  statuses,
  priorities,
  types,
  categories,
  customFields,
  templates,
  members,
  sprints,
  activeSprintId,
  meUserId,
}: {
  slug: string;
  tenantId: string;
  role: string;
  currentProject: Project;
  siblingProjects: Project[];
  initialIssues: Issue[];
  columnInfo: Record<string, BoardColumnInfo>;
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  templates: IssueTemplate[];
  members: Member[];
  sprints: Sprint[];
  currentSprint?: Sprint | null;
  activeSprintId?: string | null;
  meUserId?: string;
}) {
  const activeSprintExport = activeSprintId ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = role !== "viewer";
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [, startTransition] = useTransition();
  const [cascadePending, setCascadePending] = useState<{ issueId: string; newStatus: string; count: number } | null>(null);
  const [cascading, startCascade] = useTransition();
  const [colCursors, setColCursors] = useState<Map<string, number | null>>(
    () => new Map(Object.entries(columnInfo).map(([k, v]) => [k, v.cursor]))
  );
  const [colHasMore, setColHasMore] = useState<Map<string, boolean>>(
    () => new Map(Object.entries(columnInfo).map(([k, v]) => [k, v.hasMore]))
  );
  const [loadingMore, setLoadingMore] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const CANONICAL_STATUS_ORDER = ["backlog", "todo", "in_progress", "in_review", "done"];

  // Quick filters live in the URL (not useState) so they survive a full
  // navigation — e.g. opening an issue then hitting the browser Back button
  // unmounts this component; local state would silently reset (FORGE bug:
  // "Only my issues" reverting to off after visiting an issue). groupBy
  // already used this pattern; the rest didn't, so they had the same bug.
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  // The top bar's "+ New issue" link only sets ?new=1 in the URL — it doesn't
  // remount this component when you're already on Board, so the useState
  // initializer above never re-runs and the form silently failed to open.
  // Watch for the param instead, and strip it right after so the link stays
  // clickable again (rather than becoming a no-op once the URL already has
  // ?new=1) and a page refresh/back-navigation doesn't force the form open.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowForm(true); // eslint-disable-line react-hooks/set-state-in-effect -- syncing a one-shot ?new=1 URL trigger into local modal-open state; see TriageCard.tsx for the same precedent
      setParam("new", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Forward the active quick filters so the issue page's breadcrumb can
  // rebuild a board link that matches this URL, not a bare `?project=`.
  function openIssue(id: string) {
    router.push(`/${slug}/issues/${id}?${searchParams.toString()}`);
  }

  const groupByParam = (searchParams.get("groupBy") ?? "status") as "status" | "assignee" | "priority";
  const groupBy = ["status", "assignee", "priority"].includes(groupByParam) ? groupByParam : "status";
  function setGroupBy(value: "status" | "assignee" | "priority") {
    setParam("groupBy", value === "status" ? null : value);
  }

  const onlyMine = searchParams.get("mine") === "1";
  function setOnlyMine(v: boolean) {
    setParam("mine", v ? "1" : null);
  }
  const showAging = searchParams.get("aging") === "1";
  function setShowAging(v: boolean) {
    setParam("aging", v ? "1" : null);
  }
  const filterAssignee = searchParams.get("assignee") ?? "";
  function setFilterAssignee(v: string) {
    setParam("assignee", v || null);
  }
  const filterType = searchParams.get("type") ?? "";
  function setFilterType(v: string) {
    setParam("type", v || null);
  }
  const filterCategory = searchParams.get("category") ?? "";
  function setFilterCategory(v: string) {
    setParam("category", v || null);
  }
  const filterPriorities = useMemo(
    () => new Set((searchParams.get("pri") ?? "").split(",").filter(Boolean)),
    [searchParams]
  );
  function setFilterPriorities(fn: (prev: Set<string>) => Set<string>) {
    const next = fn(filterPriorities);
    setParam("pri", next.size > 0 ? [...next].join(",") : null);
  }
  // Collapsed columns live in the URL for the same reason as the filters
  // above: it survives opening an issue and coming back via the browser's
  // history exactly the way the URL itself does, with none of the SSR/
  // hydration-mismatch hazards a localStorage-backed useState carries.
  const collapsedCols = useMemo(
    () => new Set((searchParams.get("collapsed") ?? "").split(",").filter(Boolean)),
    [searchParams]
  );
  function setCollapsedCols(fn: (prev: Set<string>) => Set<string>) {
    const next = fn(collapsedCols);
    setParam("collapsed", next.size > 0 ? [...next].join(",") : null);
  }

  const projectKey = (id: string) => projects.find((p) => p.id === id)?.key ?? "—";
  const prMap = useMemo(() => new Map(priorities.map((o) => [o.key, o])), [priorities]);
  const tyMap = useMemo(() => new Map(types.map((o) => [o.key, o])), [types]);
  const memMap = useMemo(() => new Map(members.map((m) => [m.userId, { label: m.label, color: m.avatarColor ?? null }])), [members]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const orderedStatuses = useMemo(() => {
    return [...statuses].sort((a, b) => {
      const ai = CANONICAL_STATUS_ORDER.indexOf(a.key);
      const bi = CANONICAL_STATUS_ORDER.indexOf(b.key);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.position - b.position;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  // Same "lowest-position non-done status" rule the dedicated Backlog page
  // uses (src/app/[tenant]/backlog/page.tsx) to decide what counts as
  // backlog — dynamic, not hardcoded to a status literally named "backlog".
  // The Backlog column below renders by this same "unscheduled, not done"
  // definition instead of a plain status match, so its count matches that
  // page's count exactly: previously this column showed status === 'backlog'
  // while the Backlog page showed "unscheduled (sprint_id null) and not
  // done" — two different definitions that drift apart whenever an issue's
  // status and sprint assignment disagree (FORGE: TRAV2-55/57/110 missing
  // from one list or the other).
  const backlogStatusKey = useMemo(() => {
    const nonDone = statuses.filter((s) => s.key !== "done").sort((a, b) => a.position - b.position);
    return nonDone[0]?.key ?? null;
  }, [statuses]);

  const filtered = useMemo(() => {
    let list = issues;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        `${projectKey(i.project_id)}-${i.number}`.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.assignee_id ? (memMap.get(i.assignee_id)?.label ?? "").toLowerCase().includes(q) : false)
      );
    }
    if (onlyMine && meUserId) list = list.filter((i) => i.assignee_id === meUserId);
    if (filterPriorities.size > 0) list = list.filter((i) => filterPriorities.has(i.priority));
    if (filterAssignee === "__unassigned") list = list.filter((i) => !i.assignee_id);
    else if (filterAssignee) list = list.filter((i) => i.assignee_id === filterAssignee);
    if (filterType) list = list.filter((i) => i.type === filterType);
    if (filterCategory) list = list.filter((i) => i.category_id === filterCategory);
    return list;
  }, [issues, search, onlyMine, meUserId, filterPriorities, filterAssignee, filterType, filterCategory, memMap]);

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
    const cursor = colCursors.get(status) ?? null;
    setLoadingMore((prev) => new Set(prev).add(status));
    try {
      const { issues: more, hasMore, cursor: nextCursor } = await loadMoreForStatusAction(slug, currentProject.id, status, cursor);
      if (more.length > 0) {
        setIssues((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          return [...prev, ...more.filter((i) => !existingIds.has(i.id))];
        });
      }
      setColCursors((prev) => new Map(prev).set(status, nextCursor));
      setColHasMore((prev) => new Map(prev).set(status, hasMore));
    } finally {
      setLoadingMore((prev) => { const next = new Set(prev); next.delete(status); return next; });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--fw-cream-border)] bg-[var(--fw-cream-bg)] px-6 py-2">
        <Link
          href={`/${slug}/projects/${currentProject.key}`}
          className="flex shrink-0 items-center gap-1 text-[11px] text-[#a19d90] hover:text-[#b7452f] transition-colors"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Projects
        </Link>
        <span className="shrink-0 text-[#ddd8c9]">/</span>
        <span className="shrink-0 rounded bg-[var(--fw-cream)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#4a473e]">
          {currentProject.key}
        </span>
        {siblingProjects.length > 1 ? (
          <select
            value={currentProject.key}
            onChange={async (e) => {
              const key = e.target.value;
              const picked = siblingProjects.find((p) => p.key === key);
              // Same sticky selection as the sidebar switcher (FORGE-188) — picking a
              // project here is a real switch, not a page-local peek, so it should
              // persist after navigating away too, not silently revert. Awaited so the
              // cookie is set before navigating — otherwise the sidebar (a server
              // component reading the cookie fresh on each request) could render with
              // the stale value on this very navigation.
              if (picked) {
                await fetch("/api/current-project", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ slug, projectId: picked.id }),
                });
              }
              router.push(`/${slug}/board?project=${key}`);
            }}
            className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[13px] font-extrabold text-[#20201d] outline-none"
            aria-label="Switch project"
          >
            {siblingProjects.map((p) => (
              <option key={p.id} value={p.key}>{p.name}</option>
            ))}
          </select>
        ) : (
          <h1 className="shrink-0 font-[family-name:var(--font-manrope)] text-[14px] font-extrabold text-[#20201d]">{currentProject.name}</h1>
        )}

        <span className="flex-1" />

        {presentUsers.length > 0 && (
          <div className="hidden shrink-0 items-center lg:flex" title={presentUsers.map((u) => u.label).join(", ")}>
            {presentUsers.slice(0, 5).map((u, i) => (
              <div
                key={u.userId}
                title={u.label}
                style={{ backgroundColor: avatarColor(u.userId), marginLeft: i > 0 ? "-6px" : "0", zIndex: 10 - i }}
                className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--fw-cream-bg)] text-[9px] font-semibold text-white"
              >
                {initials(u.label)}
              </div>
            ))}
            {presentUsers.length > 5 && (
              <div style={{ marginLeft: "-6px", zIndex: 5 }} className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--fw-cream-bg)] bg-[#e3ded0] text-[9px] font-semibold text-[#4a473e]">
                +{presentUsers.length - 5}
              </div>
            )}
          </div>
        )}

        {activeSprintExport && (
          <a
            href={`/${slug}/board/export/sprint-pdf/${activeSprintExport}`}
            className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
          >
            📄 Export Sprint Report
          </a>
        )}
        {/* The global top bar's rust "New issue" button (?new=1) opens this as a
            modal (NewIssueForm) — no second "+ New issue" CTA needed here, and
            the modal has its own close controls (✕ / backdrop click). */}
      </div>

      {cascadePending && (
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-1.5 text-[12px]" style={{ borderColor: "#f0e3c9", backgroundColor: "#fdf1de", color: "#c9791d" }}>
          <span>
            This issue has <strong>{cascadePending.count}</strong> sub-issue{cascadePending.count !== 1 ? "s" : ""} not yet in <strong>{cascadePending.newStatus}</strong>. Move them too?
          </span>
          <div className="ml-4 flex shrink-0 gap-2">
            <button
              onClick={() => confirmCascade(true)}
              disabled={cascading}
              className="rounded-full bg-[#c9791d] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {cascading ? "Moving…" : "Yes, move all"}
            </button>
            <button
              onClick={() => confirmCascade(false)}
              className="rounded-full border border-[#f0e3c9] px-3 py-1 text-[11px] font-medium text-[#c9791d]"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      <BoardFilters
        search={search}
        setSearch={setSearch}
        onlyMine={onlyMine}
        setOnlyMine={setOnlyMine}
        showAging={showAging}
        setShowAging={setShowAging}
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

      {showForm && (
        <NewIssueForm
          slug={slug}
          projects={[currentProject]}
          priorities={priorities}
          types={types}
          categories={categories}
          customFields={customFields}
          templates={templates}
          sprints={sprints}
          members={members}
          onCreated={(issue) => {
            upsert(issue);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      <div data-ember-tour="board-columns" className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 py-4">
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
                <IssueCardList issues={colIssues} canEdit={false} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={openIssue} projectKey={projectKey} showAssignee showAging={showAging} />
              </div>
            );
          });
        })() : groupBy === "status" ? orderedStatuses.map((status) => {
          const isBacklogCol = status.key === backlogStatusKey;
          // Union, not a straight swap: an issue literally in this status
          // (however it got there) must always show SOMEWHERE, or it goes
          // invisible the same way TRAV2-202/203 did. sprint_id-null issues
          // of any non-done status join it too, so the count still lines up
          // with the Backlog page for the common case — but never at the
          // cost of hiding a real status === backlogStatusKey card just
          // because it's also been scheduled into a sprint (FORGE: TRAV2-214
          // has status 'backlog' AND a sprint_id — it was disappearing from
          // every column under the previous sprint_id-only definition).
          const colIssues = filtered
            .filter((i) => (isBacklogCol
              ? i.status === backlogStatusKey || (i.sprint_id == null && i.status !== "done")
              : i.status === status.key))
            .sort((a, b) => a.position - b.position);
          const isFiltered = !!(search.trim() || filterPriorities.size > 0 || filterAssignee || filterType || filterCategory);
          // loadBoard() fetches each status's own fair page, so colHasMore is
          // known accurately from first paint — no guessing based on a
          // shared global cutoff (FORGE: that guess previously hid the
          // button on exactly the columns that needed it). The backlog
          // column shows a broader "unscheduled, not done" set assembled
          // from every other column's own fetch (see backlogStatusKey
          // above), so its own load-more cursor doesn't describe that set —
          // never show the button there rather than show one that resumes
          // from the wrong place.
          const showLoadMore = !isBacklogCol && !isFiltered && (colHasMore.get(status.key) ?? false);
          const collapsed = collapsedCols.has(status.key);

          if (collapsed) {
            return (
              <button
                key={status.key}
                onClick={() => setCollapsedCols((prev) => { const next = new Set(prev); next.delete(status.key); return next; })}
                className="flex shrink-0 flex-col items-center gap-2 rounded-lg bg-[var(--fw-cream)] py-3 hover:bg-[#eae6da]"
                style={{ width: 48 }}
                title={`Expand ${status.label}`}
              >
                {status.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />}
                <span className="text-[11px] font-semibold text-[#4a473e]" style={{ writingMode: "vertical-rl" }}>{status.label}</span>
                <span className="text-[10px] text-[#a19d90]">{colIssues.length}</span>
              </button>
            );
          }

          return (
            <div
              key={status.key}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => onDrop(status.key)}
              className="flex min-h-0 shrink-0 flex-col rounded-lg bg-[var(--fw-cream)] p-3"
              style={{ width: 282 }}
            >
              <div className="mb-2 flex shrink-0 items-center justify-between px-1">
                <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-[#4a473e]">
                  {status.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />}
                  {status.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#a19d90]">{colIssues.length}</span>
                  <button
                    onClick={() => setCollapsedCols((prev) => new Set(prev).add(status.key))}
                    className="text-[#a19d90] hover:text-[#4a473e]"
                    title={`Collapse ${status.label}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </span>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto"
                onScroll={(e) => {
                  if (!showLoadMore || loadingMore.has(status.key)) return;
                  const el = e.currentTarget;
                  if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) loadMore(status.key);
                }}
              >
                {colIssues.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#ddd8c9] px-3 py-6 text-center text-[11.5px] text-[#c3bda9]">
                    Nothing here — drag a card over, or use + above
                  </div>
                ) : (
                  <IssueCardList issues={colIssues} canEdit={canEdit} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={openIssue} projectKey={projectKey} showAssignee showAging={showAging} />
                )}
                {/* Fetch more automatically as you scroll near the bottom — no click
                    needed, and always show where the list actually ends. */}
                {loadingMore.has(status.key) && (
                  <p className="mt-2 text-center text-[11px] text-[#a19d90]">Loading…</p>
                )}
                {!loadingMore.has(status.key) && colHasMore.get(status.key) === false && colIssues.length > 0 && (
                  <p className="mt-2 text-center text-[10.5px] text-[#c3bda9]">— all {colIssues.length} loaded —</p>
                )}
              </div>
            </div>
          );
        }) : groupBy === "assignee" ? (() => {
          const unassigned = filtered.filter((i) => !i.assignee_id);
          const assigneeCols = members
            .map((m) => ({ member: m, issues: filtered.filter((i) => i.assignee_id === m.userId) }))
            .filter((col) => col.issues.length > 0);
          const cols = [
            ...(unassigned.length > 0 ? [{ key: "__unassigned", label: "Unassigned", color: "#9CA3AF", issues: unassigned }] : []),
            ...assigneeCols.map((col) => ({ key: col.member.userId, label: col.member.label, color: avatarColor(col.member.userId, col.member.avatarColor), issues: col.issues })),
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
              <IssueCardList issues={col.issues} canEdit={false} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={openIssue} projectKey={projectKey} showAssignee={false} showAging={showAging} />
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
  memMap: Map<string, { label: string; color: string | null }>;
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
