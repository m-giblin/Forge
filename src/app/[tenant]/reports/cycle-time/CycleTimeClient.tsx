"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { CycleTimeResult } from "@/app/api/reports/cycle-time/route";

const PRIORITY_COLORS: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" };
const TYPE_COLORS: Record<string, string> = { bug: "#ef4444", feature: "#6366f1", task: "#94a3b8", improvement: "#8b5cf6" };

function HBar({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-right text-xs text-neutral-500">{label}</span>
      <div className="flex-1 h-5 rounded bg-neutral-100 overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-20 text-right text-xs font-semibold text-neutral-700">{value}d avg{sub ? ` (${sub})` : ""}</span>
    </div>
  );
}

export default function CycleTimeClient({
  slug, projects, initialProjectId, initialFrom, initialTo,
}: {
  slug: string; projects: { id: string; name: string }[];
  initialProjectId: string; initialFrom: string; initialTo: string;
}) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [result, setResult] = useState<CycleTimeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"priority" | "type" | "assignee" | "items">("priority");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (projectId) params.set("project", projectId);
      const res = await fetch(`/api/reports/cycle-time?${params}`, { headers: { "x-tenant-slug": slug } });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setResult(await res.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [slug, from, to, projectId]);

  useEffect(() => { void load(); }, [load]);

  const maxPriority = result ? Math.max(1, ...Object.values(result.byPriority).map((v) => v.avg)) : 1;
  const maxType = result ? Math.max(1, ...Object.values(result.byType).map((v) => v.avg)) : 1;
  const maxAssignee = result ? Math.max(1, ...result.byAssignee.map((a) => a.avg)) : 1;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
        <Link href={`/${slug}/reports`} className="hover:text-indigo-600 transition-colors">Reports</Link>
        <span>/</span>
        <span className="font-medium text-neutral-800">Cycle Time</span>
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
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      {loading && <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">Calculating cycle times…</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && !loading && (
        <>
          {result.items.length === 0 ? (
            <div className="text-center py-16 text-neutral-400 text-sm">No resolved issues found in this period. Cycle time requires issues with status-change events.</div>
          ) : (
            <>
              {/* KPI row */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[
                  { label: "Avg Cycle Time", value: `${result.avg}d`, color: result.avg <= 7 ? "#22c55e" : result.avg <= 14 ? "#f59e0b" : "#ef4444", sub: `${result.items.length} issues` },
                  { label: "Median (P50)", value: `${result.median}d`, color: "#6366f1" },
                  { label: "P90", value: `${result.p90}d`, color: "#8b5cf6", sub: "90th percentile" },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
                    {k.sub && <p className="text-[11px] text-neutral-400 mt-1">{k.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="mb-4 flex gap-1 border-b border-neutral-200">
                {(["priority", "type", "assignee", "items"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 -mb-px ${tab === t ? "border-indigo-500 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
                    {t === "items" ? "Slowest Issues" : `By ${t}`}
                  </button>
                ))}
              </div>

              {tab === "priority" && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
                  {Object.entries(result.byPriority).sort((a, b) => b[1].avg - a[1].avg).map(([p, v]) => (
                    <HBar key={p} label={`${p} (${v.count})`} value={v.avg} max={maxPriority} color={PRIORITY_COLORS[p] ?? "#94a3b8"} />
                  ))}
                </div>
              )}

              {tab === "type" && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
                  {Object.entries(result.byType).sort((a, b) => b[1].avg - a[1].avg).map(([t, v]) => (
                    <HBar key={t} label={`${t} (${v.count})`} value={v.avg} max={maxType} color={TYPE_COLORS[t] ?? "#6366f1"} />
                  ))}
                </div>
              )}

              {tab === "assignee" && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
                  {result.byAssignee.map((a) => (
                    <HBar key={a.name} label={`${a.name.split("@")[0]} (${a.count})`} value={a.avg} max={maxAssignee} color="#6366f1" />
                  ))}
                </div>
              )}

              {tab === "items" && (
                <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-900 text-white text-xs">
                        {["Title", "Priority", "Type", "Assignee", "Cycle Time"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item, i) => (
                        <tr key={item.issueId} className={`border-t border-neutral-100 ${i % 2 === 1 ? "bg-neutral-50" : "bg-white"}`}>
                          <td className="px-3 py-2 text-xs font-medium text-neutral-800 max-w-xs truncate">{item.title}</td>
                          <td className="px-3 py-2">
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: PRIORITY_COLORS[item.priority] ?? "#94a3b8" }}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-neutral-600 capitalize">{item.type}</td>
                          <td className="px-3 py-2 text-xs text-neutral-500">{item.assignee?.split("@")[0] ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`font-bold text-sm ${item.cycleDays > 14 ? "text-red-600" : item.cycleDays > 7 ? "text-amber-600" : "text-green-600"}`}>
                              {item.cycleDays}d
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
        </>
      )}
    </div>
  );
}
