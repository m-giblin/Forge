"use client";

import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { type Issue } from "@/lib/repositories/issues";
import { type FieldOption, type CustomField } from "@/lib/repositories/fieldConfig";
import { type SavedView } from "@/lib/repositories/savedViews";
import { bulkUpdateIssuesAction, bulkDeleteIssuesAction } from "./actions";
import { updateIssueAction } from "./[id]/actions";
import { createSavedViewAction, deleteSavedViewAction } from "./savedViewActions";
import { EditableSelectCell, EditableTextCell } from "./EditableCell";
import PageHeader from "@/components/patterns/PageHeader";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };

const PHASE_OPTIONS = [
  { key: "discovery", label: "Discovery" },
  { key: "design", label: "Design" },
  { key: "development", label: "Development" },
  { key: "testing", label: "Testing" },
  { key: "deployment", label: "Deployment" },
];

function dueBadge(iso: string | null): "overdue" | "soon" | "ok" | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(iso); due.setHours(0, 0, 0, 0);
  const diff = (due.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return "overdue";
  if (diff <= 3) return "soon";
  return "ok";
}

export default function IssuesTable({
  slug,
  issues,
  projects,
  statuses,
  priorities,
  types,
  members = [],
  customFields = [],
  canDelete = false,
  readOnly = false,
  savedViews = [],
  currentProjectId = null,
}: {
  slug: string;
  issues: Issue[];
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  members?: Member[];
  customFields?: CustomField[];
  canDelete?: boolean;
  readOnly?: boolean;
  savedViews?: SavedView[];
  currentProjectId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // URL-driven filter state
  const q = params.get("q") ?? "";
  const statusFilter = params.get("status") ?? "all";
  const priorityFilter = params.get("priority") ?? "all";
  const typeFilter = params.get("type") ?? "all";
  const assigneeFilter = params.get("assignee") ?? "all";
  // Falls back to the sticky project selector (FORGE-188) when the URL has no
  // explicit ?project=, so a shared/bookmarked link still wins over it.
  const projectFilter = params.get("project") ?? currentProjectId ?? "all";

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const clearFilters = useCallback(() => {
    router.replace(pathname);
  }, [pathname, router]);

  const hasFilters = q || statusFilter !== "all" || priorityFilter !== "all" || typeFilter !== "all" || assigneeFilter !== "all" || projectFilter !== "all";

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkPending, startBulk] = useTransition();
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Save view state
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewShared, setViewShared] = useState(false);
  const [savePending, startSave] = useTransition();

  const projectKey = (id: string) => projects.find((p) => p.id === id)?.key ?? "—";
  const statusLabel = (k: string) => statuses.find((o) => o.key === k)?.label ?? k;
  const memberLabel = (id: string | null) => id ? (members.find((m) => m.userId === id)?.label ?? "—") : "—";
  const prMap = useMemo(() => new Map(priorities.map((o) => [o.key, o])), [priorities]);
  const tyMap = useMemo(() => new Map(types.map((o) => [o.key, o])), [types]);

  const sortBy = params.get("sort") ?? "created";
  const sortDir = params.get("dir") ?? "desc";

  function toggleSort(field: string) {
    const next = new URLSearchParams(params.toString());
    if (sortBy === field) {
      next.set("dir", sortDir === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", field);
      next.set("dir", "desc");
    }
    router.replace(`${pathname}?${next.toString()}`);
  }

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = issues
      .filter((i) => projectFilter === "all" || i.project_id === projectFilter)
      .filter((i) => statusFilter === "all" || i.status === statusFilter)
      .filter((i) => priorityFilter === "all" || i.priority === priorityFilter)
      .filter((i) => typeFilter === "all" || i.type === typeFilter)
      .filter((i) => {
        if (assigneeFilter === "all") return true;
        if (assigneeFilter === "none") return !i.assignee_id;
        return i.assignee_id === assigneeFilter;
      })
      .filter((i) => !needle || i.title.toLowerCase().includes(needle) || (i.description ?? "").toLowerCase().includes(needle));

    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortBy === "id") {
        const ak = `${projectKey(a.project_id)}-${a.number}`;
        const bk = `${projectKey(b.project_id)}-${b.number}`;
        return ak < bk ? -dir : ak > bk ? dir : 0;
      }
      if (sortBy === "priority") {
        const diff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
        return diff * dir;
      }
      if (sortBy === "due") {
        const av = a.due_date ?? "9999";
        const bv = b.due_date ?? "9999";
        return av < bv ? -dir : av > bv ? dir : 0;
      }
      if (sortBy === "updated") {
        return a.updated_at < b.updated_at ? dir : -dir;
      }
      // default: created
      return a.created_at < b.created_at ? dir : -dir;
    });
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, q, projectFilter, statusFilter, priorityFilter, typeFilter, assigneeFilter, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );
  useEffect(() => { setPage(1); }, [q, projectFilter, statusFilter, priorityFilter, typeFilter, assigneeFilter, sortBy, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function applyBulk() {
    if (!bulkField) return;
    setBulkMsg(null);
    startBulk(async () => {
      try {
        const patch: Record<string, string | null> = {};
        if (bulkField === "status")     patch.status     = bulkValue;
        if (bulkField === "priority")   patch.priority   = bulkValue;
        if (bulkField === "type")       patch.type       = bulkValue;
        if (bulkField === "assigneeId") patch.assigneeId = bulkValue || null;
        if (bulkField === "phase")      patch.phase      = bulkValue || null;
        await bulkUpdateIssuesAction(slug, [...selected], patch as Parameters<typeof bulkUpdateIssuesAction>[2]);
        setBulkMsg(`Updated ${selected.size} issue${selected.size === 1 ? "" : "s"}`);
        setSelected(new Set());
        setBulkField("");
        setBulkValue("");
        router.refresh();
      } catch (e) {
        setBulkMsg(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function doDelete() {
    startBulk(async () => {
      try {
        await bulkDeleteIssuesAction(slug, [...selected]);
        setBulkMsg(`Deleted ${selected.size} issue${selected.size === 1 ? "" : "s"}`);
        setSelected(new Set());
        setConfirmDelete(false);
        router.refresh();
      } catch (e) {
        setBulkMsg(e instanceof Error ? e.message : "Failed");
        setConfirmDelete(false);
      }
    });
  }

  function applyView(view: SavedView) {
    const next = new URLSearchParams();
    const f = view.filters;
    if (f.status?.[0]) next.set("status", f.status[0]);
    if (f.priority?.[0]) next.set("priority", f.priority[0]);
    if (f.assignee?.[0]) next.set("assignee", f.assignee[0]);
    if (f.type?.[0]) next.set("type", f.type[0]);
    if (f.q) next.set("q", f.q);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function saveView() {
    if (!viewName.trim()) return;
    startSave(async () => {
      try {
        await createSavedViewAction(
          slug,
          viewName.trim(),
          {
            status: statusFilter !== "all" ? [statusFilter] : undefined,
            priority: priorityFilter !== "all" ? [priorityFilter] : undefined,
            assignee: assigneeFilter !== "all" ? [assigneeFilter] : undefined,
            type: typeFilter !== "all" ? [typeFilter] : undefined,
            q: q || undefined,
          },
          currentProjectId,
          viewShared
        );
        setShowSaveView(false);
        setViewName("");
        router.refresh();
      } catch (e) {
        console.error("save view failed", e);
      }
    });
  }

  function deleteView(viewId: string) {
    startSave(async () => {
      try {
        await deleteSavedViewAction(slug, viewId);
        router.refresh();
      } catch (e) {
        console.error("delete view failed", e);
      }
    });
  }

  // Inline single-cell edit. Reuses updateIssueAction so risk-gate/blocker
  // business logic (e.g. blocking a "done" transition) applies here too.
  function saveCell(issueId: string, patch: Parameters<typeof updateIssueAction>[2]) {
    return updateIssueAction(slug, issueId, patch).then(() => router.refresh());
  }

  const myViews = savedViews.filter((v) => !v.isShared);
  const teamViews = savedViews.filter((v) => v.isShared);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Table"
        subtitle={`${filtered.length} issue${filtered.length === 1 ? "" : "s"}`}
        right={
          <a
            href={`/${slug}/issues/export?${params.toString()}`}
            download
            className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
          >
            Export CSV
          </a>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-3.5">
        {/* ── Saved views bar ── */}
        {savedViews.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Views:</span>
            {myViews.map((v) => (
              <span key={v.id} className="group inline-flex items-center gap-1 rounded-full border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-0.5 text-[11.5px] text-[#4a473e] hover:bg-[#eae6da]">
                <button onClick={() => applyView(v)} className="hover:text-[#b7452f]">{v.name}</button>
                <button onClick={() => deleteView(v.id)} className="ml-0.5 hidden text-[#c3bda9] hover:text-[#c0392b] group-hover:inline">×</button>
              </span>
            ))}
            {teamViews.map((v) => (
              <span key={v.id} className="group inline-flex items-center gap-1 rounded-full border border-[#3f7d4c] bg-[#e9f3ea] px-2.5 py-0.5 text-[11.5px] text-[#3f7d4c] hover:bg-[#e9f3ea]">
                <button onClick={() => applyView(v)}>{v.name}</button>
                <button onClick={() => deleteView(v.id)} className="ml-0.5 hidden text-[#3f7d4c] hover:text-[#c0392b] group-hover:inline">×</button>
              </span>
            ))}
          </div>
        )}

        {/* ── Filter bar ── */}
        <FilterRow>
          <input
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search title + description…"
            className="w-52 shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-3 py-[6px] text-[11.5px] text-[#20201d] outline-none placeholder:text-[#a19d90]"
          />
          {projects.length > 1 && (
            <select value={projectFilter} onChange={(e) => setParam("project", e.target.value)} className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none">
              <option value="all">All projects ({issues.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.key} ({issues.filter((i) => i.project_id === p.id).length})</option>
              ))}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => setParam("status", e.target.value)} className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none">
            <option value="all">All statuses</option>
            {[...statuses].sort((a, b) => a.position - b.position).map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setParam("priority", e.target.value)} className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none">
            <option value="all">All priorities</option>
            {priorities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setParam("type", e.target.value)} className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none">
            <option value="all">All types</option>
            {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {members.length > 0 && (
            <select value={assigneeFilter} onChange={(e) => setParam("assignee", e.target.value)} className="shrink-0 whitespace-nowrap rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none">
              <option value="all">All assignees</option>
              <option value="none">Unassigned</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
            </select>
          )}
          {hasFilters && (
            <FilterPill onClick={clearFilters}>Clear</FilterPill>
          )}
          {hasFilters && (
            <button
              onClick={() => setShowSaveView(true)}
              className="shrink-0 whitespace-nowrap rounded-full border border-[#8c4632] bg-[#f4ecfa] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#7a4fa0] hover:bg-[#efe3f7]"
            >
              Save view
            </button>
          )}
        </FilterRow>

      {/* ── Save view dialog ── */}
      {showSaveView && (
        <div className="mb-4 mt-3 flex items-center gap-2 rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-[#20201d]">Save current filters as:</span>
          <input
            autoFocus
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setShowSaveView(false); }}
            placeholder="View name…"
            className="rounded-lg border border-[#ddd8c9] bg-white px-2.5 py-1 text-[12.5px] outline-none focus:border-[#8c4632]"
          />
          <label className="flex items-center gap-1.5 text-[11.5px] text-[#4a473e] cursor-pointer">
            <input type="checkbox" checked={viewShared} onChange={(e) => setViewShared(e.target.checked)} className="rounded accent-[#8c4632]" />
            Share with team
          </label>
          <button onClick={saveView} disabled={savePending || !viewName.trim()} className="rounded-lg bg-[#8c4632] bg-[image:linear-gradient(160deg,#9a5138,#6e3324)] border border-[#5e2c1f] px-3 py-1.5 text-[11.5px] font-bold text-[#f2e9d8] disabled:opacity-50">
            {savePending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setShowSaveView(false)} className="text-[11.5px] text-[#726e60] hover:text-[#20201d]">Cancel</button>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {someSelected && (
        <div className="mb-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-[#20201d]">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-[11.5px] text-[#726e60] hover:text-[#20201d]">Clear</button>
          <div className="ml-2 flex items-center gap-2">
            <select
              value={bulkField}
              onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}
              className="rounded-lg border border-[#ddd8c9] bg-white px-2 py-1.5 text-[12.5px]"
            >
              <option value="">Change field…</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
              <option value="type">Type</option>
              <option value="assigneeId">Assignee</option>
              <option value="phase">Phase</option>
            </select>
            {bulkField === "status" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-[#ddd8c9] bg-white px-2 py-1.5 text-[12.5px]">
                <option value="">Pick status…</option>
                {[...statuses].sort((a, b) => a.position - b.position).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            )}
            {bulkField === "priority" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-[#ddd8c9] bg-white px-2 py-1.5 text-[12.5px]">
                <option value="">Pick priority…</option>
                {priorities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            )}
            {bulkField === "type" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-[#ddd8c9] bg-white px-2 py-1.5 text-[12.5px]">
                <option value="">Pick type…</option>
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            )}
            {bulkField === "assigneeId" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-[#ddd8c9] bg-white px-2 py-1.5 text-[12.5px]">
                <option value="">Unassign</option>
                {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
              </select>
            )}
            {bulkField === "phase" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-[#ddd8c9] bg-white px-2 py-1.5 text-[12.5px]">
                <option value="">Clear phase</option>
                <option value="discovery">Discovery</option>
                <option value="design">Design</option>
                <option value="development">Development</option>
                <option value="testing">Testing</option>
                <option value="deployment">Deployment</option>
              </select>
            )}
            {bulkField && (
              <button
                onClick={applyBulk}
                disabled={bulkPending || !bulkField}
                className="rounded-lg bg-[#8c4632] bg-[image:linear-gradient(160deg,#9a5138,#6e3324)] border border-[#5e2c1f] px-3 py-1.5 text-[11.5px] font-bold text-[#f2e9d8] disabled:opacity-50"
              >
                {bulkPending ? "Applying…" : "Apply"}
              </button>
            )}
          </div>
          {canDelete && (
            confirmDelete ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12.5px] font-semibold text-[#c0392b]">Delete {selected.size} issue{selected.size === 1 ? "" : "s"}?</span>
                <button onClick={doDelete} disabled={bulkPending} className="rounded-lg bg-[#c0392b] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#a53024] disabled:opacity-50">
                  {bulkPending ? "Deleting…" : "Yes, delete"}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-[11.5px] text-[#726e60] hover:text-[#20201d]">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="ml-auto text-[11.5px] font-bold text-[#c0392b] hover:underline">
                Delete selected
              </button>
            )
          )}
          {bulkMsg && <span className="ml-2 text-[11.5px] text-[#4a473e]">{bulkMsg}</span>}
        </div>
      )}

      {/* ── Table ── */}
      <div className="fw-card mt-3 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[#e3ded0] bg-[#eae6da] text-left text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-[#ddd8c9] accent-[#8c4632]"
                  aria-label="Select all"
                />
              </th>
              <SortTh label="ID" field="id" current={sortBy} dir={sortDir} onToggle={toggleSort} />
              <th className="px-4 py-2.5 font-extrabold">Title</th>
              <th className="px-4 py-2.5 font-extrabold">Type</th>
              <SortTh label="Priority" field="priority" current={sortBy} dir={sortDir} onToggle={toggleSort} />
              <th className="px-4 py-2.5 font-extrabold">Assignee</th>
              <th className="px-4 py-2.5 font-extrabold">Phase <span className="normal-case font-normal text-[10px] text-[#c3bda9]">(stage)</span></th>
              <SortTh label="Due" field="due" current={sortBy} dir={sortDir} onToggle={toggleSort} />
              <th className="px-4 py-2.5 font-extrabold">Status</th>
              <SortTh label="Updated" field="updated" current={sortBy} dir={sortDir} onToggle={toggleSort} />
              {customFields.map((f) => (
                <th key={f.id} className="px-4 py-2.5 font-extrabold">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((i) => {
              const ty = tyMap.get(i.type);
              const pr = prMap.get(i.priority);
              const badge = dueBadge(i.due_date);
              const isSelected = selected.has(i.id);
              return (
                <tr
                  key={i.id}
                  className={`border-t border-[#e3ded0] first:border-t-0 hover:bg-[#eae6da]/50 ${isSelected ? "bg-[#f4ecfa] hover:bg-[#f4ecfa]" : ""}`}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(i.id)}
                      className="h-4 w-4 rounded border-[#ddd8c9] accent-[#8c4632]"
                      aria-label={`Select ${i.title}`}
                    />
                  </td>
                  <td
                    className="cursor-pointer whitespace-nowrap px-4 py-2.5 font-mono text-[11px] font-bold text-[#726e60]"
                    onClick={() => router.push(`/${slug}/issues/${i.id}`)}
                  >
                    {projectKey(i.project_id)}-{i.number}
                  </td>
                  <td className="cursor-pointer px-4 py-2.5 text-[#20201d]" onClick={() => router.push(`/${slug}/issues/${i.id}`)}>
                    {i.title}
                  </td>
                  <td className="px-4 py-2.5 text-[#4a473e]" onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={i.type}
                      options={types}
                      disabled={readOnly}
                      onSave={(v) => saveCell(i.id, { type: v })}
                    />
                  </td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={i.priority}
                      options={priorities}
                      disabled={readOnly}
                      onSave={(v) => saveCell(i.id, { priority: v })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-[#4a473e]" onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={i.assignee_id ?? ""}
                      options={members.map((m) => ({ key: m.userId, label: m.label }))}
                      placeholder="Unassigned"
                      disabled={readOnly}
                      onSave={(v) => saveCell(i.id, { assigneeId: v || null })}
                    />
                  </td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={i.phase ?? ""}
                      options={PHASE_OPTIONS}
                      placeholder="—"
                      disabled={readOnly}
                      onSave={(v) => saveCell(i.id, { phase: v || null })}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <span className={
                      badge === "overdue" ? "font-semibold text-[#c0392b]" :
                      badge === "soon"    ? "font-semibold text-[#c9791d]" :
                      ""
                    }>
                      <EditableTextCell
                        type="date"
                        value={i.due_date ? i.due_date.slice(0, 10) : ""}
                        disabled={readOnly}
                        onSave={(v) => saveCell(i.id, { dueDate: v || null })}
                      />
                      {badge === "overdue" && <span className="ml-1 text-xs">⚠</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#4a473e]" onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={i.status}
                      options={[...statuses].sort((a, b) => a.position - b.position)}
                      disabled={readOnly}
                      onSave={(v) => saveCell(i.id, { status: v })}
                    />
                  </td>
                  {customFields.map((f) => (
                    <td key={f.id} className="px-4 py-2.5 text-[#4a473e]" onClick={(e) => e.stopPropagation()}>
                      {f.type === "select" ? (
                        <EditableSelectCell
                          value={String((i.custom_values ?? {})[f.key] ?? "")}
                          options={(f.options ?? []).map((o) => ({ key: o, label: o }))}
                          placeholder="—"
                          disabled={readOnly}
                          onSave={(v) => saveCell(i.id, { customValues: { [f.key]: v || null } })}
                        />
                      ) : (
                        <EditableTextCell
                          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                          value={String((i.custom_values ?? {})[f.key] ?? "")}
                          disabled={readOnly}
                          onSave={(v) => saveCell(i.id, { customValues: { [f.key]: v || null } })}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10 + customFields.length} className="px-4 py-10 text-center text-[12.5px] text-[#a19d90]">
                  {hasFilters ? "No issues match the current filters." : "No issues yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2.5 text-[11.5px] text-[#726e60]">
          <span>
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-1 font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <span className="px-1.5 font-semibold text-[#20201d]">Page {currentPage} of {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-1 font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function SortTh({ label, field, current, dir, onToggle }: {
  label: string;
  field: string;
  current: string;
  dir: string;
  onToggle: (f: string) => void;
}) {
  const active = current === field;
  return (
    <th className="px-4 py-2.5 font-extrabold">
      <button
        onClick={() => onToggle(field)}
        className={`flex items-center gap-1 transition-colors hover:text-[#4a473e] ${active ? "text-[#20201d]" : "text-[#a19d90]"}`}
      >
        {label}
        <span className="text-[10px]">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
