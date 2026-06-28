"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AgingResult } from "@/app/api/reports/aging/route";

const PRIORITY_COLORS: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" };
const BUCKET_COLORS = ["#22c55e", "#f59e0b", "#f97316", "#ef4444"];

export default function AgingClient({
  slug, projects, initialProjectId,
}: {
  slug: string; projects: { id: string; name: string }[]; initialProjectId: string;
}) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [result, setResult] = useState<AgingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "priority" | "oldest">("overview");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("project", projectId);
      const res = await fetch(`/api/reports/aging?${params}`, { headers: { "x-tenant-slug": slug } });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setResult(await res.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [slug, projectId]);

  useEffect(() => { void load(); }, [load]);

  const maxBucket = result ? Math.max(1, ...result.buckets.map((b) => b.count)) : 1;

  return (
    <div>
      <div className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href={`/${slug}/reports`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <span className="text-neutral-400">←</span> Reports
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-800">Issue Aging</span>
        <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">PRO</span>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50 transition-colors">↻ Refresh</button>
      </div>

      {loading && <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">Analyzing issue ages…</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && !loading && (
        <>
          {/* KPI row */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Open Issues</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{result.totalOpen}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Avg Age</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: result.avgAgeDays > 30 ? "#ef4444" : result.avgAgeDays > 14 ? "#f59e0b" : "#22c55e" }}>{result.avgAgeDays}d</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Stale (90+ days)</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{result.buckets[3]?.count ?? 0}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">{result.totalOpen > 0 ? Math.round((result.buckets[3]?.count ?? 0) / result.totalOpen * 100) : 0}% of open</p>
            </div>
          </div>

          {/* Warning banner if lots of stale issues */}
          {(result.buckets[3]?.count ?? 0) > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <span className="text-amber-500 text-lg mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">{result.buckets[3].count} issues are 90+ days old</p>
                <p className="text-xs text-amber-700 mt-0.5">These are risk flags for stakeholder reviews. Review and either close or prioritize.</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-4 flex gap-1 border-b border-neutral-200">
            {(["overview", "priority", "oldest"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 -mb-px ${tab === t ? "border-indigo-500 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
                {t === "overview" ? "Age Buckets" : t === "oldest" ? "Oldest Issues" : "By Priority"}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="space-y-4">
                {result.buckets.map((b, i) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-right text-xs text-neutral-500">{b.label}</span>
                    <div className="flex-1 h-7 rounded bg-neutral-100 overflow-hidden">
                      <div className="h-full rounded transition-all flex items-center pl-2" style={{ width: `${maxBucket > 0 ? (b.count / maxBucket) * 100 : 0}%`, backgroundColor: BUCKET_COLORS[i] }}>
                        {b.count > 0 && <span className="text-[11px] font-bold text-white">{b.count}</span>}
                      </div>
                    </div>
                    <span className="w-10 text-right text-sm font-semibold text-neutral-700">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "priority" && (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-900 text-white text-xs">
                    <th className="px-3 py-2 text-left font-semibold">Priority</th>
                    {result.buckets.map((b) => (
                      <th key={b.label} className="px-3 py-2 text-center font-semibold">{b.label}</th>
                    ))}
                    <th className="px-3 py-2 text-center font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {["urgent", "high", "medium", "low"].map((p, i) => {
                    const row = result.byPriority[p];
                    const total = row ? row.reduce((s, b) => s + b.count, 0) : 0;
                    return (
                      <tr key={p} className={`border-t border-neutral-100 ${i % 2 === 1 ? "bg-neutral-50" : ""}`}>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                            <span className="text-xs font-semibold capitalize text-neutral-700">{p}</span>
                          </span>
                        </td>
                        {(row ?? result.buckets.map(() => ({ count: 0 }))).map((b, j) => (
                          <td key={j} className="px-3 py-2 text-center">
                            <span className={`text-sm font-semibold ${b.count > 0 && j >= 2 ? "text-red-600" : b.count > 0 ? "text-neutral-700" : "text-neutral-300"}`}>
                              {b.count || "—"}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center text-sm font-bold text-neutral-900">{total || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === "oldest" && (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-900 text-white text-xs">
                    {["Title", "Priority", "Status", "Assignee", "Age"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.oldest.map((row, i) => (
                    <tr key={row.issueId} className={`border-t border-neutral-100 ${i % 2 === 1 ? "bg-neutral-50" : ""}`}>
                      <td className="px-3 py-2 text-xs font-medium text-neutral-800 max-w-xs truncate">{row.title}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: PRIORITY_COLORS[row.priority] ?? "#94a3b8" }}>
                          {row.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-600 capitalize">{row.status.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-xs text-neutral-500">{row.assignee?.split("@")[0] ?? "Unassigned"}</td>
                      <td className="px-3 py-2">
                        <span className={`font-bold text-sm ${row.ageDays >= 90 ? "text-red-600" : row.ageDays >= 30 ? "text-amber-600" : "text-neutral-700"}`}>
                          {row.ageDays}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
