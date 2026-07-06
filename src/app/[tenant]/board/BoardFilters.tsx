"use client";

import { type FieldOption, type Category } from "@/lib/repositories/fieldConfig";

type Member = { userId: string; label: string };

export default function BoardFilters({
  search,
  setSearch,
  filterPriorities,
  setFilterPriorities,
  filterAssignee,
  setFilterAssignee,
  filterType,
  setFilterType,
  filterCategory,
  setFilterCategory,
  groupBy,
  setGroupBy,
  priorities,
  types,
  categories,
  members,
}: {
  search: string;
  setSearch: (v: string) => void;
  filterPriorities: Set<string>;
  setFilterPriorities: (fn: (prev: Set<string>) => Set<string>) => void;
  filterAssignee: string;
  setFilterAssignee: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  groupBy: "status" | "assignee" | "priority";
  setGroupBy: (v: "status" | "assignee" | "priority") => void;
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  members: Member[];
}) {
  const hasFilters = !!(search || filterPriorities.size > 0 || filterAssignee || filterType || filterCategory);

  return (
    <div className="mb-4 space-y-2">
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
      {hasFilters && (
        <button
          onClick={() => {
            setSearch("");
            setFilterPriorities(() => new Set());
            setFilterAssignee("");
            setFilterType("");
            setFilterCategory("");
          }}
          className="text-xs text-neutral-400 hover:text-neutral-700"
        >
          Clear
        </button>
      )}
    </div>
  );
}
