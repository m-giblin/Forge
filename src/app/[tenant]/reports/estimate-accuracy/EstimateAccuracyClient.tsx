"use client";

import { useState } from "react";
import Link from "next/link";
import type { AccuracyIssue } from "./page";

function fmtMins(m: number): string {
  if (m === 0) return "0h";
  const h = Math.floor(Math.abs(m) / 60);
  const rem = Math.abs(m) % 60;
  const sign = m < 0 ? "-" : "";
  return rem === 0 ? `${sign}${h}h` : `${sign}${h}h ${rem}m`;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

type Project = { id: string; name: string; key: string };

interface Props {
  slug: string;
  issues: AccuracyIssue[];
  projects: Project[];
}

export default function EstimateAccuracyClient({ slug, issues, projects }: Props) {
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  const filtered = projectFilter ? issues.filter((i) => i.projectId === projectFilter) : issues;

  const avgAccuracy = filtered.length > 0
    ? Math.round(filtered.reduce((s, i) => s + i.accuracyPct, 0) / filtered.length)
    : 0;
  const medVariance = median(filtered.map((i) => i.varianceMinutes));
  const withinTwenty = filtered.length > 0
    ? Math.round(filtered.filter((i) => i.accuracyPct >= 80).length / filtered.length * 100)
    : 0;

  const avgVariancePct = filtered.length > 0
    ? Math.round(filtered.reduce((s, i) => s + i.variancePct, 0) / filtered.length)
    : 0;
  const tendency = avgVariancePct > 5 ? "over-estimate work" : avgVariancePct < -5 ? "under-estimate work" : "estimate accurately";

  // Histogram buckets: <50%, 50-80%, 80-120%, 120-150%, >150% of estimate
  // accuracy = min(estimated,logged)/max(estimated,logged)*100
  const buckets = [
    { label: "<50%", min: 0, max: 50, color: "#ef4444" },
    { label: "50–80%", min: 50, max: 80, color: "#f97316" },
    { label: "80–120%", min: 80, max: 120, color: "#22c55e" },
    { label: "120–150%", min: 120, max: 150, color: "#f97316" },
    { label: ">150%", min: 150, max: Infinity, color: "#ef4444" },
  ];

  const bucketCounts = buckets.map((b) => ({
    ...b,
    count: filtered.filter((i) => i.accuracyPct >= b.min && i.accuracyPct < b.max).length,
  }));
  const maxBucket = Math.max(1, ...bucketCounts.map((b) => b.count));

  return (
    <div className="space-y-6 p-6">
      <Link href={`/${slug}/reports`} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors group">
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Reports
      </Link>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Estimate Accuracy</h1>
        <p className="text-sm text-neutral-500 mt-0.5">How close were estimates to actual time logged on completed issues</p>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center">
          <p className="text-sm text-neutral-500">No completed issues with both estimates and time logs in the last 90 days.</p>
        </div>
      ) : (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Avg Accuracy", value: `${avgAccuracy}%`, color: avgAccuracy >= 80 ? "text-emerald-700" : avgAccuracy >= 60 ? "text-amber-600" : "text-red-600" },
              { label: "Median Variance", value: fmtMins(medVariance), color: "text-neutral-700" },
              { label: "Issues Analyzed", value: String(filtered.length), color: "text-indigo-700" },
              { label: "Within 20% of Estimate", value: `${withinTwenty}%`, color: withinTwenty >= 70 ? "text-emerald-700" : "text-amber-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{s.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Project filter pills */}
          {projects.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setProjectFilter(null)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${!projectFilter ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
              >
                All projects
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProjectFilter(projectFilter === p.id ? null : p.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${projectFilter === p.id ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                >
                  {p.key} · {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Accuracy distribution histogram */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-4">Accuracy Distribution</p>
            <div className="flex items-end gap-3 h-36">
              {bucketCounts.map((b) => (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                  {b.count > 0 && (
                    <span className="text-xs font-semibold text-neutral-700">{b.count}</span>
                  )}
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (b.count / maxBucket) * 100)}%`,
                      backgroundColor: b.color,
                      opacity: b.label === "80–120%" ? 1 : 0.7,
                    }}
                  />
                  <span className="text-[10px] text-neutral-500 text-center whitespace-nowrap">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">Green = 80–120% (good). Accuracy = min(estimate,logged)/max(estimate,logged)</p>
          </div>

          {/* Insights callout */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
            <p className="text-sm font-semibold text-indigo-900 mb-1">Insights</p>
            <p className="text-sm text-indigo-800">
              Your team&apos;s estimates are <strong>{avgAccuracy}%</strong> accurate on average.
              {avgVariancePct !== 0 && (
                <> You tend to <strong>{tendency}</strong> by about <strong>{Math.abs(avgVariancePct)}%</strong>.</>
              )}
              {' '}{withinTwenty}% of issues land within 20% of their estimate.
            </p>
          </div>

          {/* Issue table */}
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{filtered.length} issues (sorted: worst accuracy first)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-50 text-left">
                    {["Issue", "Title", "Project", "Estimated", "Logged", "Variance", "Accuracy"].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-semibold text-neutral-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((issue) => (
                    <tr key={issue.id} className="border-t border-neutral-50 hover:bg-neutral-50">
                      <td className="px-4 py-2.5 font-mono font-bold text-indigo-600 whitespace-nowrap">
                        {issue.projectKey}-{issue.number}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-800 max-w-[200px] truncate" title={issue.title}>
                        {issue.title}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500">{issue.projectName}</td>
                      <td className="px-4 py-2.5 tabular-nums text-neutral-700">{fmtMins(issue.estimatedMinutes)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-neutral-700">{fmtMins(issue.loggedMinutes)}</td>
                      <td className={`px-4 py-2.5 tabular-nums font-medium ${issue.varianceMinutes > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {issue.varianceMinutes > 0 ? "+" : ""}{fmtMins(issue.varianceMinutes)}
                        <span className="ml-1 text-neutral-400">({issue.variancePct > 0 ? "+" : ""}{issue.variancePct}%)</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${
                          issue.accuracyPct >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : issue.accuracyPct >= 60 ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-red-50 text-red-600 border border-red-200"
                        }`}>
                          {issue.accuracyPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
