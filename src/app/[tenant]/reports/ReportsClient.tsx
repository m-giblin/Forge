"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReportsData } from "@/lib/services/reports";

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog", todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done",
};
const STATUS_COLORS: Record<string, string> = {
  backlog: "#94a3b8", todo: "#64748b", in_progress: "#6366f1", in_review: "#8b5cf6", done: "#22c55e",
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 truncate text-right text-neutral-600 text-xs">{label}</span>
      <div className="flex-1 h-5 bg-neutral-100 rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-6 text-right text-xs font-medium text-neutral-700">{value}</span>
    </div>
  );
}

function TrendChart({ data }: { data: { label: string; opened: number; closed: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-neutral-400 text-center py-8">No data in range</p>;
  const w = 500, h = 140, pad = 32;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.opened, d.closed)));
  const xStep = (w - pad * 2) / Math.max(1, data.length - 1);
  const y = (v: number) => h - pad - (v / maxVal) * (h - pad * 2);
  const openedPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${y(d.opened)}`).join(" ");
  const closedPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${y(d.closed)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full">
        {[0, maxVal].map((v) => (
          <line key={v} x1={pad} y1={y(v)} x2={w - pad} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
        ))}
        <path d={openedPath} fill="none" stroke="#6366f1" strokeWidth="2" />
        <path d={closedPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 2" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={pad + i * xStep} cy={y(d.opened)} r="3" fill="#6366f1" />
            <circle cx={pad + i * xStep} cy={y(d.closed)} r="3" fill="#22c55e" />
            {data.length <= 12 && (
              <text x={pad + i * xStep} y={h + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex gap-4 justify-center text-xs text-neutral-500 mt-1">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-indigo-500" />Opened</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-green-500 border-dashed border-b border-green-500" />Closed</span>
      </div>
    </div>
  );
}

export default function ReportsClient({
  slug,
  data,
  from,
  to,
  projectId,
}: {
  slug: string;
  data: ReportsData;
  from: string;
  to: string;
  projectId: string;
}) {
  const router = useRouter();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const [localProject, setLocalProject] = useState(projectId);

  function applyFilters() {
    const p = new URLSearchParams();
    if (localFrom) p.set("from", localFrom);
    if (localTo) p.set("to", localTo);
    if (localProject) p.set("project", localProject);
    router.push(`/${slug}/reports?${p.toString()}`);
  }

  const maxStatus = Math.max(1, ...data.byStatus.map((b) => b.count));
  const maxPriority = Math.max(1, ...data.byPriority.map((b) => b.count));
  const maxAssignee = Math.max(1, ...data.byAssignee.map((b) => b.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Issue analytics for your workspace</p>
        </div>
        {/* Filters */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={localProject}
            onChange={(e) => setLocalProject(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All projects</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          <span className="text-neutral-400 text-sm">→</span>
          <input
            type="date"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          <button
            onClick={applyFilters}
            className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium"
          >
            Apply
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open issues", value: data.totalOpen, color: "text-indigo-600" },
          { label: "Closed in range", value: data.totalDone, color: "text-green-600" },
          { label: "By status groups", value: data.byStatus.length, color: "text-neutral-700" },
          { label: "Assignees active", value: data.byAssignee.filter((a) => a.assigneeId !== null).length, color: "text-purple-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Weekly trend */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-800 mb-4">Issues opened vs closed (weekly)</h2>
        <TrendChart data={data.weeklyTrend} />
      </div>

      {/* Bottom row: 3 charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* By status */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">By status</h2>
          {data.byStatus.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">No issues in range</p>
          ) : (
            data.byStatus.map((s) => (
              <HBar
                key={s.status}
                label={STATUS_LABELS[s.status] ?? s.status}
                value={s.count}
                max={maxStatus}
                color={STATUS_COLORS[s.status] ?? "#94a3b8"}
              />
            ))
          )}
        </div>

        {/* By priority */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">By priority</h2>
          {data.byPriority.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">No issues in range</p>
          ) : (
            data.byPriority.map((p) => (
              <HBar
                key={p.priority}
                label={p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}
                value={p.count}
                max={maxPriority}
                color={PRIORITY_COLORS[p.priority] ?? "#94a3b8"}
              />
            ))
          )}
        </div>

        {/* By assignee */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-neutral-800 mb-3">Open issues by assignee</h2>
          {data.byAssignee.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">No open issues</p>
          ) : (
            data.byAssignee.map((a) => (
              <HBar
                key={a.assigneeId ?? "__unassigned__"}
                label={a.name}
                value={a.count}
                max={maxAssignee}
                color={a.assigneeId ? "#6366f1" : "#94a3b8"}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
