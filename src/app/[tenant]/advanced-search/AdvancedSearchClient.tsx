"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { SearchResultIssue } from "@/lib/services/searchQuery";
import type { SavedView } from "@/lib/repositories/savedViews";
import {
  listSavedViewsAction, createSavedViewAction, deleteSavedViewAction,
} from "@/app/[tenant]/issues/savedViewActions";

const EXAMPLE_QUERIES = [
  { label: "My open urgent bugs", query: 'type = "bug" AND priority = "urgent" AND assignee = "me"' },
  { label: "High priority features", query: 'priority = "high" AND type = "feature"' },
  { label: "In review on WEB", query: 'status = "in_review" AND project = "WEB"' },
  { label: "Todo, any project", query: 'status = "todo"' },
];

const STATUS_COLORS: Record<string, string> = {
  backlog: "#94a3b8", todo: "#64748b", in_progress: "#6366f1", in_review: "#f59e0b", done: "#22c55e", closed: "#22c55e",
};
const PRIORITY_COLORS: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" };

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
    <div className="max-w-4xl">
      <div className="mb-1">
        <h1 className="text-lg font-bold text-neutral-900">Advanced Search</h1>
        <p className="text-sm text-neutral-500">
          A power-user query layer on top of the same search everywhere else in Forge uses — the ⌘K command palette and Table&apos;s filters. Write <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">field = &quot;value&quot;</code> clauses joined with <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">AND</code>, plus any plain text to search titles/descriptions/comments.
        </p>
      </div>

      <div className="mt-4 mb-2 flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => { setQuery(ex.query); void run(ex.query); }}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void run(query); }}
          placeholder='status = "todo" AND priority = "high"'
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
        />
        <button
          onClick={() => void run(query)}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          {loading ? "Searching…" : "Run"}
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {results && !error && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              {results.length} issue{results.length === 1 ? "" : "s"} matched
              {truncated ? " (showing first 200 — narrow your query for a complete list)" : ""}
            </p>
            {!readOnly && ranQuery && (
              <button onClick={saveCurrentQuery} className="text-xs font-medium text-indigo-600 hover:underline">
                💾 Save this query
              </button>
            )}
          </div>
          {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}

          {results.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
              No issues match this query.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                      <td className="px-3 py-2">
                        <Link href={`/${slug}/issues/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.key}</Link>
                      </td>
                      <td className="px-3 py-2 text-neutral-800">{r.title}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: STATUS_COLORS[r.status] ?? "#94a3b8" }}>{r.status}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: PRIORITY_COLORS[r.priority] ?? "#94a3b8" }}>{r.priority}</span>
                      </td>
                      <td className="px-3 py-2 text-neutral-500">{r.assignee ?? "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-2 text-sm font-semibold text-neutral-800">Saved queries</h2>
        {savedLoading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : savedViews.length === 0 ? (
          <p className="text-sm text-neutral-400">No saved queries yet — run a query above and save it.</p>
        ) : (
          <ul className="space-y-1.5">
            {savedViews.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                <button onClick={() => loadSavedView(v)} className="text-left font-medium text-neutral-800 hover:text-indigo-700">
                  {v.name}
                  {v.isShared && <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-normal text-neutral-600">shared</span>}
                  <span className="ml-2 font-mono text-xs font-normal text-neutral-400">{v.filters.q}</span>
                </button>
                {!readOnly && (
                  <button onClick={() => removeSavedView(v.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
