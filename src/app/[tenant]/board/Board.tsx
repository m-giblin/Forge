"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Issue } from "@/lib/repositories/issues";
import { type Sprint } from "@/lib/repositories/sprints";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { isUnassignedOverdue } from "@/lib/sla";
import { createIssueAction, moveIssueAction } from "./actions";
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canEdit = role !== "viewer";
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterPriorities, setFilterPriorities] = useState<Set<string>>(new Set());
  const [filterAssignee, setFilterAssignee] = useState("");
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

      channel = supabase
        .channel(`issues:${tenantId}`)
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
        .subscribe();
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
        await moveIssueAction(slug, id, status);
      } catch {
        upsert(current); // revert on failure
      }
    });
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
          <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">
            {currentProject.key}
          </span>
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
        {canEdit && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {showForm ? "Close" : "+ New issue"}
          </button>
        )}
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
          Showing {issueLimit} of {total} issues — use search or filters to narrow results.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, description, assignee…"
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
        />
        <div className="flex flex-wrap gap-1">
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
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
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
        <div className="flex rounded-lg border border-neutral-300 text-sm">
          <button
            onClick={() => setGroupBy("status")}
            className={`px-3 py-1.5 ${groupBy === "status" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"} rounded-l-lg`}
          >
            By Status
          </button>
          <button
            onClick={() => setGroupBy("assignee")}
            className={`px-3 py-1.5 ${groupBy === "assignee" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"} border-l border-neutral-300`}
          >
            By Assignee
          </button>
          <button
            onClick={() => setGroupBy("priority")}
            className={`px-3 py-1.5 ${groupBy === "priority" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"} rounded-r-lg border-l border-neutral-300`}
          >
            By Priority
          </button>
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
          onCreated={(issue) => {
            upsert(issue);
            setShowForm(false);
          }}
        />
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {groupBy === "priority" ? (() => {
          const orderedPriorities = [...priorities].sort((a, b) => a.position - b.position);
          return orderedPriorities.map((p) => {
            const colIssues = filtered.filter((i) => i.priority === p.key).sort((a, b) => a.position - b.position);
            if (colIssues.length === 0) return null;
            return (
              <div key={p.key} className="flex w-72 shrink-0 flex-col rounded-xl bg-neutral-100/70 p-3">
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
          return (
            <div
              key={status.key}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => onDrop(status.key)}
              className="flex w-72 shrink-0 flex-col rounded-xl bg-neutral-100/70 p-3"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  {status.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />}
                  {status.label}
                </span>
                <span className="text-xs text-neutral-400">{colIssues.length}</span>
              </div>
              <IssueCardList issues={colIssues} canEdit={canEdit} slug={slug} tyMap={tyMap} prMap={prMap} memMap={memMap} catMap={catMap} onDragStart={setDragId} onClickIssue={(id) => router.push(`/${slug}/issues/${id}`)} projectKey={projectKey} showAssignee />
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
            <div key={col.key} className="flex w-72 shrink-0 flex-col rounded-xl bg-neutral-100/70 p-3">
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
  onCreated,
}: {
  slug: string;
  projects: Project[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  onCreated: (issue: Issue) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState(defaultKey(priorities));
  const [type, setType] = useState(defaultKey(types));
  const [categoryId, setCategoryId] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Issue title…"
          className="min-w-[240px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
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
        <button
          onClick={submit}
          disabled={pending || !title.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>

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
