"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { type Issue } from "@/lib/repositories/issues";
import { type FieldOption, type CustomField } from "@/lib/repositories/fieldConfig";
import { type SavedView } from "@/lib/repositories/savedViews";
import { bulkUpdateIssuesAction, bulkDeleteIssuesAction } from "./actions";
import { createSavedViewAction, deleteSavedViewAction } from "./savedViewActions";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const clearFilters = useCallback(() => {
    router.replace(pathname);
  }, [pathname, router]);

  const hasFilters = q || statusFilter !== "all" || priorityFilter !== "all" || typeFilter !== "all" || assigneeFilter !== "all";

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkPending, startBulk] = useTransition();
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  }, [issues, q, statusFilter, priorityFilter, typeFilter, assigneeFilter, sortBy, sortDir]);

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

  const myViews = savedViews.filter((v) => !v.isShared);
  const teamViews = savedViews.filter((v) => v.isShared);

  return (
    <div>
      {/* ── Saved views bar ── */}
      {savedViews.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mr-1">Views:</span>
          {myViews.map((v) => (
            <span key={v.id} className="group inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-700 hover:border-blue-300 hover:bg-blue-50">
              <button onClick={() => applyView(v)} className="hover:text-blue-700">{v.name}</button>
              <button onClick={() => deleteView(v.id)} className="ml-0.5 hidden text-neutral-300 hover:text-red-500 group-hover:inline">×</button>
            </span>
          ))}
          {teamViews.map((v) => (
            <span key={v.id} className="group inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 hover:border-emerald-400">
              <button onClick={() => applyView(v)}>{v.name}</button>
              <button onClick={() => deleteView(v.id)} className="ml-0.5 hidden text-emerald-300 hover:text-red-500 group-hover:inline">×</button>
            </span>
          ))}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold text-neutral-900">
          Issues <span className="text-sm font-normal text-neutral-400">({filtered.length})</span>
        </h1>
        <input
          value={q}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="Search title + description…"
          className="w-52 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
        />
        <select value={statusFilter} onChange={(e) => setParam("status", e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="all">All statuses</option>
          {[...statuses].sort((a, b) => a.position - b.position).map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(e) => setParam("priority", e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="all">All priorities</option>
          {priorities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setParam("type", e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="all">All types</option>
          {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {members.length > 0 && (
          <select value={assigneeFilter} onChange={(e) => setParam("assignee", e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
            <option value="all">All assignees</option>
            <option value="none">Unassigned</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-900">
            Clear
          </button>
        )}
        {hasFilters && (
          <button
            onClick={() => setShowSaveView(true)}
            className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            Save view
          </button>
        )}
        <a
          href={`/${slug}/issues/export?${params.toString()}`}
          download
          className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-900"
        >
          ↓ CSV
        </a>
      </div>

      {/* ── Save view dialog ── */}
      {showSaveView && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">Save current filters as:</span>
          <input
            autoFocus
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setShowSaveView(false); }}
            placeholder="View name…"
            className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-sm outline-none focus:border-blue-500"
          />
          <label className="flex items-center gap-1.5 text-xs text-blue-700 cursor-pointer">
            <input type="checkbox" checked={viewShared} onChange={(e) => setViewShared(e.target.checked)} className="rounded accent-blue-600" />
            Share with team
          </label>
          <button onClick={saveView} disabled={savePending || !viewName.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {savePending ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setShowSaveView(false)} className="text-xs text-blue-500 hover:text-blue-700">Cancel</button>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {someSelected && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-blue-500 hover:text-blue-700">Clear</button>
          <div className="ml-2 flex items-center gap-2">
            <select
              value={bulkField}
              onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}
              className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Change field…</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
              <option value="type">Type</option>
              <option value="assigneeId">Assignee</option>
              <option value="phase">Phase</option>
            </select>
            {bulkField === "status" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm">
                <option value="">Pick status…</option>
                {[...statuses].sort((a, b) => a.position - b.position).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            )}
            {bulkField === "priority" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm">
                <option value="">Pick priority…</option>
                {priorities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            )}
            {bulkField === "type" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm">
                <option value="">Pick type…</option>
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            )}
            {bulkField === "assigneeId" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm">
                <option value="">Unassign</option>
                {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
              </select>
            )}
            {bulkField === "phase" && (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm">
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
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkPending ? "Applying…" : "Apply"}
              </button>
            )}
          </div>
          {canDelete && (
            confirmDelete ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-red-700 font-medium">Delete {selected.size} issue{selected.size === 1 ? "" : "s"}?</span>
                <button onClick={doDelete} disabled={bulkPending} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {bulkPending ? "Deleting…" : "Yes, delete"}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-sm text-neutral-500 hover:text-neutral-700">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="ml-auto text-sm font-medium text-red-600 hover:text-red-700">
                Delete selected
              </button>
            )
          )}
          {bulkMsg && <span className="ml-2 text-sm text-blue-700">{bulkMsg}</span>}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <SortTh label="Priority" field="priority" current={sortBy} dir={sortDir} onToggle={toggleSort} />
              <th className="px-4 py-2.5 font-medium">Assignee</th>
              <th className="px-4 py-2.5 font-medium">Phase <span className="normal-case font-normal text-[10px] text-neutral-300">(stage)</span></th>
              <SortTh label="Due" field="due" current={sortBy} dir={sortDir} onToggle={toggleSort} />
              <th className="px-4 py-2.5 font-medium">Status</th>
              <SortTh label="Updated" field="updated" current={sortBy} dir={sortDir} onToggle={toggleSort} />
              {customFields.map((f) => (
                <th key={f.id} className="px-4 py-2.5 font-medium">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const ty = tyMap.get(i.type);
              const pr = prMap.get(i.priority);
              const badge = dueBadge(i.due_date);
              const isSelected = selected.has(i.id);
              return (
                <tr
                  key={i.id}
                  className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50 ${isSelected ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(i.id)}
                      className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
                      aria-label={`Select ${i.title}`}
                    />
                  </td>
                  <td
                    className="cursor-pointer whitespace-nowrap px-4 py-2.5 font-medium text-neutral-400"
                    onClick={() => router.push(`/${slug}/issues/${i.id}`)}
                  >
                    {projectKey(i.project_id)}-{i.number}
                  </td>
                  <td className="cursor-pointer px-4 py-2.5 text-neutral-800" onClick={() => router.push(`/${slug}/issues/${i.id}`)}>
                    {i.title}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    <span style={{ color: ty?.color ?? undefined }}>{ty?.label ?? i.type}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-neutral-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pr?.color ?? "#9CA3AF" }} />
                      {pr?.label ?? i.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{memberLabel(i.assignee_id)}</td>
                  <td className="px-4 py-2.5">
                    {i.phase ? (
                      <span className="inline-flex rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                        {i.phase.charAt(0).toUpperCase() + i.phase.slice(1)}
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {i.due_date ? (
                      <span className={
                        badge === "overdue" ? "font-medium text-red-600" :
                        badge === "soon"    ? "font-medium text-amber-600" :
                        "text-neutral-600"
                      }>
                        {formatDate(i.due_date)}
                        {badge === "overdue" && <span className="ml-1 text-xs">⚠</span>}
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{statusLabel(i.status)}</td>
                  {customFields.map((f) => (
                    <td key={f.id} className="px-4 py-2.5 text-neutral-600">
                      {String((i.custom_values ?? {})[f.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10 + customFields.length} className="px-4 py-10 text-center text-sm text-neutral-400">
                  {hasFilters ? "No issues match the current filters." : "No issues yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
    <th className="px-4 py-2.5 font-medium">
      <button
        onClick={() => onToggle(field)}
        className={`flex items-center gap-1 hover:text-neutral-700 transition-colors ${active ? "text-neutral-900" : "text-neutral-400"}`}
      >
        {label}
        <span className="text-[10px]">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
