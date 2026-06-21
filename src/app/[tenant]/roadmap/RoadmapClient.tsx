"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { ProjectRow } from "./page";
import { saveRoadmapPositionAction } from "./actions";

type IssueCountEntry = { todo: number; in_progress: number; done: number; total: number };

type Props = {
  slug: string;
  projects: ProjectRow[];
  issueCounts: Record<string, IssueCountEntry>;
};

type DraggingState = { id: string; startX: number; origPct: number };
type CascadeState = { movedId: string; movedName: string; shift: number; dependents: { id: string; name: string }[] };

function getBarColor(status: string): string {
  if (status === "in_progress") return "bg-indigo-500";
  if (status === "done") return "bg-emerald-500";
  if (status === "todo") return "bg-sky-500";
  return "bg-neutral-400";
}

function estimateWidthPct(issueCount: number): number {
  // 2–12 weeks, mapped to ~5%–25% of 6-month track
  const weeks = Math.min(12, Math.max(2, 2 + Math.floor(issueCount / 5)));
  // 6 months ≈ 26 weeks; width = weeks/26 * 100
  return Math.round((weeks / 26) * 100);
}

function getMonthHeaders(): { label: string; pct: number }[] {
  const now = new Date();
  const headers: { label: string; pct: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    headers.push({
      label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      pct: (i / 6) * 100,
    });
  }
  return headers;
}

export default function RoadmapClient({ slug, projects, issueCounts }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Compute initial positions — prefer persisted DB value (roadmap_position * 100), fall back to created_at spread
  const initPositions = (): Record<string, number> => {
    if (projects.length === 0) return {};
    const result: Record<string, number> = {};
    // If any project has a persisted position, use DB values for all
    const anyPersisted = projects.some((p) => p.roadmap_position != null);
    if (anyPersisted) {
      for (const p of projects) {
        result[p.id] = p.roadmap_position != null ? Math.round(p.roadmap_position * 100) : 0;
      }
      return result;
    }
    // Fall back to created_at spread
    const dates = projects.map((p) => new Date(p.created_at).getTime());
    const earliest = Math.min(...dates);
    const range = Date.now() - earliest || 1;
    for (const p of projects) {
      const offset = (new Date(p.created_at).getTime() - earliest) / range;
      result[p.id] = Math.min(85, Math.round(offset * 60));
    }
    return result;
  };

  const initWidths = (): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const p of projects) {
      if (p.roadmap_width != null) {
        result[p.id] = Math.round(p.roadmap_width * 100);
      } else {
        const counts = issueCounts[p.id];
        result[p.id] = estimateWidthPct(counts?.total ?? 0);
      }
    }
    return result;
  };

  const [positions, setPositions] = useState<Record<string, number>>(initPositions);
  const [widths] = useState<Record<string, number>>(initWidths);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [cascadeConfirm, setCascadeConfirm] = useState<CascadeState | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragging.startX;
      const deltaPct = (deltaX / rect.width) * 100;
      const newPct = Math.max(0, Math.min(85, dragging.origPct + deltaPct));
      setPositions((prev) => ({ ...prev, [dragging.id]: newPct }));
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!dragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragging.startX;
      const deltaPct = (deltaX / rect.width) * 100;
      const newPct = Math.max(0, Math.min(85, dragging.origPct + deltaPct));
      const shift = newPct - dragging.origPct;

      // Check overlaps (within 5% buffer)
      const movedWidth = widths[dragging.id] ?? 10;
      const movedStart = newPct;
      const movedEnd = movedStart + movedWidth;

      const overlapping = projects.filter((p) => {
        if (p.id === dragging.id) return false;
        const otherStart = positions[p.id] ?? 0;
        const otherEnd = otherStart + (widths[p.id] ?? 10);
        return movedStart < otherEnd + 5 && movedEnd + 5 > otherStart;
      });

      if (overlapping.length > 0 && Math.abs(shift) > 1) {
        const movedProject = projects.find((p) => p.id === dragging.id);
        setCascadeConfirm({
          movedId: dragging.id,
          movedName: movedProject?.name ?? "",
          shift,
          dependents: overlapping.map((p) => ({ id: p.id, name: p.name })),
        });
      }

      // Persist position to DB (best-effort, fails silently if migration not run yet)
      void saveRoadmapPositionAction(slug, dragging.id, newPct, widths[dragging.id] ?? 10).catch(() => null);

      setDragging(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, positions, widths, projects]);

  const applyCascade = () => {
    if (!cascadeConfirm) return;
    setPositions((prev) => {
      const next = { ...prev };
      for (const dep of cascadeConfirm.dependents) {
        const newPos = Math.max(0, Math.min(85, (prev[dep.id] ?? 0) + cascadeConfirm.shift));
        next[dep.id] = newPos;
        void saveRoadmapPositionAction(slug, dep.id, newPos, widths[dep.id] ?? 10).catch(() => null);
      }
      return next;
    });
    setCascadeConfirm(null);
  };

  const monthHeaders = getMonthHeaders();

  if (projects.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Roadmap</h1>
        <div className="rounded-xl border border-neutral-200 bg-white p-16 text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h2 className="text-lg font-semibold text-neutral-700 mb-2">No projects yet</h2>
          <p className="text-neutral-500 text-sm mb-6">Create your first project to see it on the roadmap.</p>
          <Link
            href={`/${slug}/projects`}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Roadmap</h1>

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        {/* Month headers */}
        <div className="flex border-b border-neutral-100 bg-neutral-50">
          <div className="w-48 shrink-0 border-r border-neutral-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Project
          </div>
          <div className="relative flex-1 h-8 overflow-hidden">
            {monthHeaders.map((m) => (
              <span
                key={m.label}
                className="absolute top-2 text-xs text-neutral-400 font-medium"
                style={{ left: `${m.pct}%` }}
              >
                {m.label}
              </span>
            ))}
            {/* Grid lines */}
            {monthHeaders.map((m) => (
              <div
                key={`line-${m.label}`}
                className="absolute top-0 bottom-0 border-l border-neutral-100"
                style={{ left: `${m.pct}%` }}
              />
            ))}
          </div>
        </div>

        {/* Gantt rows */}
        {projects.map((project) => {
          const counts = issueCounts[project.id] ?? { todo: 0, in_progress: 0, done: 0, total: 0 };
          const pct = positions[project.id] ?? 0;
          const w = widths[project.id] ?? 10;
          const barColor = getBarColor(project.status);
          const isExpanded = drillId === project.id;
          const donePct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

          return (
            <div key={project.id} className="border-b border-neutral-100 last:border-0">
              <div className="flex items-stretch">
                {/* Left column */}
                <button
                  className="w-48 shrink-0 border-r border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
                  onClick={() => setDrillId(isExpanded ? null : project.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {project.key}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-800 truncate">{project.name}</p>
                  {counts.total > 0 && (
                    <div className="mt-1.5">
                      <div className="h-1 rounded-full bg-neutral-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${donePct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{donePct}% done</p>
                    </div>
                  )}
                </button>

                {/* Gantt track */}
                <div
                  ref={trackRef}
                  className="relative flex-1 py-3 select-none"
                  style={{ minHeight: "60px" }}
                >
                  {/* Grid lines */}
                  {monthHeaders.map((m) => (
                    <div
                      key={`row-line-${m.label}`}
                      className="absolute top-0 bottom-0 border-l border-neutral-100"
                      style={{ left: `${m.pct}%` }}
                    />
                  ))}

                  {/* Draggable bar */}
                  <div
                    className={`absolute top-3 h-8 rounded-md ${barColor} opacity-90 hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity flex items-center px-3 shadow-sm`}
                    style={{ left: `${pct}%`, width: `${w}%` }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDragging({ id: project.id, startX: e.clientX, origPct: pct });
                    }}
                  >
                    <span className="text-xs font-medium text-white truncate select-none">
                      {project.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Drill-down */}
              {isExpanded && (
                <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3 ml-48">
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-neutral-500">
                      <span className="font-semibold text-sky-600">{counts.todo}</span> todo
                    </span>
                    <span className="text-neutral-500">
                      <span className="font-semibold text-indigo-600">{counts.in_progress}</span> in progress
                    </span>
                    <span className="text-neutral-500">
                      <span className="font-semibold text-emerald-600">{counts.done}</span> done
                    </span>
                    <span className="text-neutral-500">
                      <span className="font-semibold text-neutral-700">{counts.total}</span> total
                    </span>
                    <Link
                      href={`/${slug}/issues?project=${project.key}`}
                      className="ml-auto text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                    >
                      View issues →
                    </Link>
                  </div>
                  {project.target_go_live && (
                    <p className="text-xs text-neutral-400 mt-1">
                      Target go-live: {new Date(project.target_go_live).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cascade confirm callout */}
      {cascadeConfirm && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            Cascade shift for overlapping projects?
          </p>
          <p className="text-sm text-amber-700 mb-3">
            Moving <strong>{cascadeConfirm.movedName}</strong> overlaps with:{" "}
            {cascadeConfirm.dependents.map((d) => d.name).join(", ")}. Apply the same shift?
          </p>
          <div className="flex gap-2">
            <button
              onClick={applyCascade}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              Apply cascade
            </button>
            <button
              onClick={() => setCascadeConfirm(null)}
              className="rounded-lg border border-amber-300 px-4 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              Leave in place
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
