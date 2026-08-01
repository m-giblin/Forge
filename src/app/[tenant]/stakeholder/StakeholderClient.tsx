"use client";

import { useState } from "react";
import type { ProjectSummary, WorkspaceKpis } from "./page";
import PageHeader from "@/components/patterns/PageHeader";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";
import StatCard from "@/components/patterns/StatCard";

interface Props {
  projects: ProjectSummary[];
  workspaceKpis: WorkspaceKpis;
  tenantName: string;
  slug: string;
}

const STATUS_CONFIG = {
  on_track: { label: "On Track", fg: "#3f7d4c", bg: "#e9f3ea" },
  at_risk: { label: "At Risk", fg: "#c9791d", bg: "#fdf1de" },
  blocked: { label: "Blocked", fg: "#c0392b", bg: "#fbeae8" },
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
  const color = pct >= 70 ? "#3f7d4c" : pct >= 50 ? "#c9791d" : "#c0392b";
  return (
    <div className="h-2 rounded-full bg-[#ddd8c9] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
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
    <main className="flex h-[calc(100vh-56px)] flex-col overflow-hidden md:h-screen">
      <PageHeader
        title={`Executive Summary — ${tenantName}`}
        subtitle="Auto-generated from sprint data"
        right={
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
          >
            Export PDF
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px] pb-7">
        <div className="max-w-[1050px]">
          {/* Project filter */}
          {projects.length > 0 && (
            <FilterRow>
              <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
                All
              </FilterPill>
              {projects.map((p) => (
                <FilterPill key={p.key} active={filter === p.key} onClick={() => setFilter(filter === p.key ? "all" : p.key)}>
                  {p.key}
                </FilterPill>
              ))}
            </FilterRow>
          )}

          {/* KPI strip */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Sprint completion"
              value={`${workspaceKpis.sprintCompletion}%`}
              hint="done / total issues"
            />
            <StatCard
              label="Projects on track"
              value={`${workspaceKpis.onTrack} / ${workspaceKpis.total}`}
              hint="on track vs total"
            />
            <StatCard
              label="At-risk projects"
              value={String(workspaceKpis.totalBlockers)}
              hint="open blockers, across all projects"
            />
            <StatCard
              label="Portfolio health"
              value={portfolioLabel}
              hint={`${workspaceKpis.total} active project${workspaceKpis.total !== 1 ? "s" : ""}`}
            />
          </div>

          {/* Project cards */}
          {visible.length === 0 ? (
            <div className="fw-card mt-4 p-10 text-center text-[12.5px] text-[#726e60]">
              No active projects found.
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {visible.map((p) => {
                const cfg = STATUS_CONFIG[p.derivedStatus];
                const dateStr = formatDate(p.target_go_live);
                const overdue = isOverdue(p.target_go_live);

                return (
                  <div key={p.id} className="fw-card p-4 sm:px-[18px] sm:py-4">
                    {/* Title row */}
                    <div className="flex items-center gap-2.5">
                      <span className="text-[14px] font-bold text-[#20201d]">{p.name}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ color: cfg.fg, backgroundColor: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                      <span className="font-mono text-[11px] text-[#a19d90]">{p.key}</span>
                      <div className="flex-1" />
                      <span className="font-[family-name:var(--font-manrope)] text-[16px] font-extrabold text-[#20201d]">
                        {p.health}%
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="my-[11px]">
                      <ProgressBar pct={p.health} />
                    </div>

                    <p className="text-[12px] leading-[1.5] text-[#726e60]">
                      <span className="text-[#20201d]">{p.openCount}</span> open ·{" "}
                      <span className="text-[#20201d]">{p.doneCount}</span> done ·{" "}
                      <span className="text-[#20201d]">{p.totalCount}</span> total
                      {dateStr && (
                        <>
                          {" · "}
                          Target go-live:{" "}
                          <span className={overdue ? "font-bold text-[#c0392b]" : "font-semibold text-[#4a473e]"}>
                            {dateStr}
                            {overdue && " · overdue"}
                          </span>
                        </>
                      )}
                    </p>

                    {/* Blocker callout */}
                    {p.openBlockers > 0 && (
                      <div className="mt-2.5 rounded-md border border-[#ddd8c9] bg-[#fdf1de] px-3 py-2 text-[12px] text-[#c9791d]">
                        ⚠️ {p.openBlockers} issue{p.openBlockers !== 1 ? "s" : ""} blocked
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
