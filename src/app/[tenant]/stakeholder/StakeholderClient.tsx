"use client";

import { useState } from "react";
import type { ProjectSummary, WorkspaceKpis } from "./page";

interface Props {
  projects: ProjectSummary[];
  workspaceKpis: WorkspaceKpis;
  tenantName: string;
  slug: string;
}

const STATUS_CONFIG = {
  on_track: {
    label: "On Track",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
  },
  at_risk: {
    label: "At Risk",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
  },
  blocked: {
    label: "Blocked",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700",
  },
};

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${danger ? "text-red-600" : "text-neutral-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function StakeholderClient({ projects, workspaceKpis, tenantName }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const portfolioLabel =
    workspaceKpis.total === 0
      ? "—"
      : workspaceKpis.onTrack === workspaceKpis.total
      ? "On Track"
      : workspaceKpis.totalBlockers > 0
      ? "Blocked"
      : "At Risk";

  const visible = filter === "all" ? projects : projects.filter((p) => p.key === filter);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Executive Summary &mdash; {tenantName}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">Auto-generated from sprint data</p>
        </div>
        <button
          onClick={() => window.print()}
          className="self-start sm:self-auto rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition"
        >
          Export PDF
        </button>
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === "all"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            All
          </button>
          {projects.map((p) => (
            <button
              key={p.key}
              onClick={() => setFilter(filter === p.key ? "all" : p.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === p.key
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {p.key}
            </button>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label="Projects On Track"
          value={`${workspaceKpis.onTrack} / ${workspaceKpis.total}`}
          sub="on track vs total"
        />
        <KpiTile
          label="Open Blockers"
          value={String(workspaceKpis.totalBlockers)}
          sub="across all projects"
          danger={workspaceKpis.totalBlockers > 0}
        />
        <KpiTile
          label="Sprint Completion"
          value={`${workspaceKpis.sprintCompletion}%`}
          sub="done / total issues"
        />
        <KpiTile
          label="Portfolio Health"
          value={portfolioLabel}
          sub={`${workspaceKpis.total} active project${workspaceKpis.total !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Project cards */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No active projects found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map((p) => {
            const cfg = STATUS_CONFIG[p.derivedStatus];
            const dateStr = formatDate(p.target_go_live);
            const overdue = isOverdue(p.target_go_live);

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                        {p.key}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-base font-semibold text-neutral-900 truncate">
                      {p.name}
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span>Sprint progress</span>
                    <span className="font-semibold">{p.health}%</span>
                  </div>
                  <ProgressBar pct={p.health} />
                </div>

                {/* Milestone */}
                {dateStr && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-500">Target go-live:</span>
                    <span className={overdue ? "font-semibold text-red-600" : "font-medium text-neutral-700"}>
                      {dateStr}
                      {overdue && " · overdue"}
                    </span>
                  </div>
                )}

                {/* Issue counts */}
                <div className="flex gap-4 text-sm text-neutral-600">
                  <span>
                    <span className="font-semibold text-neutral-900">{p.openCount}</span> open
                  </span>
                  <span>
                    <span className="font-semibold text-neutral-900">{p.doneCount}</span> done
                  </span>
                  <span>
                    <span className="font-semibold text-neutral-900">{p.totalCount}</span> total
                  </span>
                </div>

                {/* Blocker callout */}
                {p.openBlockers > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ⚠️ {p.openBlockers} issue{p.openBlockers !== 1 ? "s" : ""} blocked
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
