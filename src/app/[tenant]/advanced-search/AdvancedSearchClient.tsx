"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { SearchResultIssue } from "@/lib/services/searchQuery";
import type { SavedView } from "@/lib/repositories/savedViews";
import {
  listSavedViewsAction, createSavedViewAction, deleteSavedViewAction,
} from "@/app/[tenant]/issues/savedViewActions";
import PageHeader from "@/components/patterns/PageHeader";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";
import FormGrid from "@/components/patterns/admin/FormGrid";
import AdminList from "@/components/patterns/admin/AdminList";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";

const EXAMPLE_QUERIES = [
  { label: "My open urgent bugs", query: 'type = "bug" AND priority = "urgent" AND assignee = "me"' },
  { label: "High priority features", query: 'priority = "high" AND type = "feature"' },
  { label: "In review on WEB", query: 'status = "in_review" AND project = "WEB"' },
  { label: "Todo, any project", query: 'status = "todo"' },
];

const STATUS_COLORS: Record<string, string> = {
  backlog: "#a19d90", todo: "#726e60", in_progress: "#3a6ea8", in_review: "#c9791d", done: "#3f7d4c", closed: "#3f7d4c",
};
const PRIORITY_COLORS: Record<string, string> = { urgent: "#c0392b", high: "#c9791d", medium: "#b7452f", low: "#3f7d4c" };
const TINT: Record<string, string> = { "#a19d90": "#f1efe9", "#726e60": "#f1efe9", "#3a6ea8": "#eaf1f8", "#c9791d": "#fdf1de", "#3f7d4c": "#e9f3ea", "#c0392b": "#fbeae8", "#b7452f": "#f3e4dd" };

export default function AdvancedSearchClient({ slug, readOnly }: { slug: string; readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultIssue[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranQuery, setRanQuery] = useState<string | null>(null);

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshSavedViews = useCallback(async () => {
    setSavedLoading(true);
    try {
      const views = await listSavedViewsAction(slug);
      // AQL-authored saved views are the ones with a raw query stashed in
      // filters.q — Table's own saved views only ever set `status`, never
      // `q`, so this cleanly separates the two without a new column.
      setSavedViews(views.filter((v) => !!v.filters.q));
    } catch {
      // best-effort — an empty list is a safe fallback, not worth a visible error
    } finally {
      setSavedLoading(false);
    }
  }, [slug]);

  useEffect(() => { void refreshSavedViews(); }, [refreshSavedViews]);

  async function run(q: string) {
    if (!q.trim()) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ slug, q: q.trim() });
      const res = await fetch(`/api/search/advanced?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setResults(json.data);
      setTruncated(!!json.truncated);
      setRanQuery(q.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentQuery() {
    if (!ranQuery) return;
    const name = window.prompt("Name this saved query:");
    if (!name?.trim()) return;
    const isShared = window.confirm("Share this with your whole team? Cancel to keep it just for you.");
    setSaveError(null);
    try {
      await createSavedViewAction(slug, name.trim(), { q: ranQuery }, null, isShared);
      await refreshSavedViews();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save query");
    }
  }

  async function removeSavedView(id: string) {
    if (!window.confirm("Delete this saved query?")) return;
    try {
      await deleteSavedViewAction(slug, id);
      await refreshSavedViews();
    } catch {
      // list just won't update — non-fatal
    }
  }

  function loadSavedView(view: SavedView) {
    const q = view.filters.q ?? "";
    setQuery(q);
    void run(q);
  }

  return (
    <div>
      <PageHeader title="Advanced Search" subtitle="Query every project with a field-based expression" />

      <div className="max-w-4xl space-y-5 px-6 py-5">
        <p className="text-[11.5px] text-[#726e60]">
          A power-user query layer on top of the same search everywhere else in Forge uses — the ⌘K command palette and Table&apos;s filters. Write <code className="rounded bg-[#e3ded0] px-1 py-0.5 text-[11px]">field = &quot;value&quot;</code> clauses joined with <code className="rounded bg-[#e3ded0] px-1 py-0.5 text-[11px]">AND</code>, plus any plain text to search titles/descriptions/comments.
        </p>

        <FilterRow>
          {EXAMPLE_QUERIES.map((ex) => (
            <FilterPill key={ex.label} onClick={() => { setQuery(ex.query); void run(ex.query); }}>
              {ex.label}
            </FilterPill>
          ))}
        </FilterRow>

        <FormGrid
          fields={[
            {
              key: "query",
              label: "Query",
              input: (
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void run(query); }}
                  placeholder='status = "todo" AND priority = "high"'
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-[11px] py-[9px] font-mono text-[12px] text-[#20201d] outline-none focus:border-[#b7452f]"
                />
              ),
            },
            {
              key: "results",
              label: "Results",
              input: (
                <span className="flex items-center rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-[11px] py-[9px] text-[12.5px] text-[#726e60]">
                  {results ? `${results.length} issue${results.length === 1 ? "" : "s"}` : "Run a query to see results"}
                </span>
              ),
            },
          ]}
          onSubmit={() => void run(query)}
          submitLabel={loading ? "Searching…" : "Run search"}
        />

        {error && <div className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</div>}

        {results && !error && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] text-[#726e60]">
                {results.length} issue{results.length === 1 ? "" : "s"} matched
                {truncated ? " (showing first 200 — narrow your query for a complete list)" : ""}
              </p>
              {!readOnly && ranQuery && (
                <button onClick={saveCurrentQuery} className="text-[11.5px] font-semibold text-[#b7452f] hover:underline">
                  💾 Save this query
                </button>
              )}
            </div>
            {saveError && <p className="mb-2 text-[11px] text-[#c0392b]">{saveError}</p>}

            {results.length === 0 ? (
              <div className="fw-card px-6 py-10 text-center text-[12.5px] text-[#a19d90]">
                No issues match this query.
              </div>
            ) : (
              <AdminTable
                columns={[
                  { label: "Key", width: 110 },
                  { label: "Title", flex: true },
                  { label: "Status", width: 130 },
                  { label: "Priority", width: 110 },
                  { label: "Assignee", width: 150 },
                ]}
                rows={results.map((r): AdminTableCell[] => [
                  { value: <Link href={`/${slug}/issues/${r.id}`} className="font-semibold text-[#b7452f] hover:underline">{r.key}</Link> },
                  { value: <Link href={`/${slug}/issues/${r.id}`} className="truncate text-[#20201d]">{r.title}</Link> },
                  { kind: "chip", value: r.status, chipFg: STATUS_COLORS[r.status] ?? "#4a473e", chipBg: TINT[STATUS_COLORS[r.status]] ?? "#f1efe9" },
                  { kind: "chip", value: r.priority, chipFg: PRIORITY_COLORS[r.priority] ?? "#4a473e", chipBg: TINT[PRIORITY_COLORS[r.priority]] ?? "#f1efe9" },
                  { kind: "dim", value: r.assignee ?? "Unassigned" },
                ])}
              />
            )}
          </div>
        )}

        <div>
          <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Saved queries</p>
          {savedLoading ? (
            <p className="text-[12.5px] text-[#a19d90]">Loading…</p>
          ) : savedViews.length === 0 ? (
            <p className="text-[12.5px] text-[#a19d90]">No saved queries yet — run a query above and save it.</p>
          ) : (
            <AdminList
              items={savedViews.map((v) => ({
                key: v.id,
                title: (
                  <button onClick={() => loadSavedView(v)} className="text-left hover:text-[#b7452f]">
                    {v.name}
                    {v.isShared && <span className="ml-2 rounded bg-[#e3ded0] px-1.5 py-0.5 text-[10px] font-semibold text-[#4a473e]">shared</span>}
                  </button>
                ),
                subline: <span className="font-mono">{v.filters.q}</span>,
                actionLabel: !readOnly ? "Delete" : undefined,
                onAction: !readOnly ? () => removeSavedView(v.id) : undefined,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
