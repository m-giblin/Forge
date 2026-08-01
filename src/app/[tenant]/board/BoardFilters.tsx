"use client";

import { type FieldOption, type Category } from "@/lib/repositories/fieldConfig";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";
import Toggle from "@/components/patterns/Toggle";

type Member = { userId: string; label: string };

function Divider() {
  return <span className="h-4 w-px shrink-0 bg-[var(--fw-cream-border)]" />;
}

export default function BoardFilters({
  search,
  setSearch,
  onlyMine,
  setOnlyMine,
  showAging,
  setShowAging,
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
  onlyMine: boolean;
  setOnlyMine: (v: boolean) => void;
  showAging: boolean;
  setShowAging: (v: boolean) => void;
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
  const hasFilters = !!(search || onlyMine || filterPriorities.size > 0 || filterAssignee || filterType || filterCategory);

  return (
    <div className="border-b border-[var(--fw-cream-border)] bg-[var(--fw-cream-bg)] px-6 py-2.5">
      <FilterRow>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{ width: 190 }}
          className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-3 py-[6px] text-[11.5px] text-[#20201d] outline-none placeholder:text-[#a19d90] focus:border-[#8c4632]"
        />

        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium text-[#4a473e]">
          <Toggle on={onlyMine} onChange={setOnlyMine} label="Only my issues" />
          Only my issues
        </span>

        <Divider />

        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium text-[#4a473e]">
          <Toggle on={showAging} onChange={setShowAging} label="Aging" />
          Aging
        </span>

        <Divider />

        {priorities.map((p) => {
          const active = filterPriorities.has(p.key);
          return (
            <FilterPill
              key={p.key}
              active={active}
              onClick={() =>
                setFilterPriorities((prev) => {
                  const next = new Set(prev);
                  if (active) next.delete(p.key); else next.add(p.key);
                  return next;
                })
              }
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: active ? "#f2e9d8" : (p.color ?? "#a19d90") }} />
              {p.label}
            </FilterPill>
          );
        })}

        <Divider />

        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none"
        >
          <option value="">Assignee</option>
          <option value="__unassigned">Unassigned</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.label}</option>)}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none"
        >
          <option value="">Types</option>
          {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none"
          >
            <option value="">Categories</option>
            {categories.filter((c) => !c.parent_id).flatMap((top) => [
              <option key={top.id} value={top.id}>{top.name}</option>,
              ...categories.filter((c) => c.parent_id === top.id).map((sub) => (
                <option key={sub.id} value={sub.id}>— {sub.name}</option>
              )),
            ])}
          </select>
        )}

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as "status" | "assignee" | "priority")}
          className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none"
        >
          <option value="status">View: Status</option>
          <option value="assignee">View: Assignee</option>
          <option value="priority">View: Priority</option>
        </select>

        <span className="flex-1" />

        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              setOnlyMine(false);
              setFilterPriorities(() => new Set());
              setFilterAssignee("");
              setFilterType("");
              setFilterCategory("");
            }}
            className="shrink-0 whitespace-nowrap text-[11.5px] font-semibold text-[#b7452f] hover:text-[#8c4632]"
          >
            Clear filters
          </button>
        )}
      </FilterRow>
    </div>
  );
}
