"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import type { ProjectRow, PhaseRow } from "./page";
import { saveRoadmapPositionAction } from "./actions";
import { createPhaseAction, updatePhaseAction, deletePhaseAction, assignProjectPhaseAction } from "./roadmapPhaseActions";

type IssueCountEntry = { todo: number; in_progress: number; done: number; total: number };

const PHASE_COLORS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Orange", value: "#f97316" },
];

type DepEdge = { fromProjectId: string; toProjectId: string };

type Props = {
  slug: string;
  projects: ProjectRow[];
  issueCounts: Record<string, IssueCountEntry>;
  phases: PhaseRow[];
  userRole: string;
  deps?: DepEdge[];
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

export default function RoadmapClient({ slug, projects, issueCounts, phases: initialPhases, userRole, deps = [] }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const [arcPaths, setArcPaths] = useState<{ path: string; key: string }[]>([]);

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

  // Phase management state
  const [phases, setPhases] = useState<PhaseRow[]>(initialPhases);
  const [showPhasePanel, setShowPhasePanel] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PhaseRow | null>(null);
  const [newPhase, setNewPhase] = useState({ name: "", color: PHASE_COLORS[0].value, start_date: "", end_date: "" });
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [phasePending, startPhaseTransition] = useTransition();
  const isAdmin = userRole === "owner" || userRole === "admin";

  // Recompute arc paths whenever deps, positions, or widths change.
  // Reads bar DOM positions via data-project-id attributes.
  useEffect(() => {
    if (deps.length === 0 || !ganttRef.current) { setArcPaths([]); return; }
    const container = ganttRef.current;
    const containerRect = container.getBoundingClientRect();

    function barCenterX(projectId: string, isEnd: boolean): number | null {
      const bar = container.querySelector<HTMLElement>(`[data-bar-id="${projectId}"]`);
      if (!bar) return null;
      const r = bar.getBoundingClientRect();
      return (isEnd ? r.right : r.left) - containerRect.left;
    }
    function rowCenterY(projectId: string): number | null {
      const row = container.querySelector<HTMLElement>(`[data-row-id="${projectId}"]`);
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return r.top + r.height / 2 - containerRect.top;
    }

    const paths: { path: string; key: string }[] = [];
    for (const dep of deps) {
      const x1 = barCenterX(dep.fromProjectId, true);
      const y1 = rowCenterY(dep.fromProjectId);
      const x2 = barCenterX(dep.toProjectId, false);
      const y2 = rowCenterY(dep.toProjectId);
      if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
      const cx = (x1 + x2) / 2;
      paths.push({
        key: `${dep.fromProjectId}-${dep.toProjectId}`,
        path: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
      });
    }
    setArcPaths(paths);
  }, [deps, positions]);

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

  function handleCreatePhase() {
    if (!newPhase.name.trim()) return;
    setPhaseError(null);
    startPhaseTransition(async () => {
      try {
        await createPhaseAction(slug, {
          name: newPhase.name,
          color: newPhase.color,
          start_date: newPhase.start_date || null,
          end_date: newPhase.end_date || null,
        });
        setNewPhase({ name: "", color: PHASE_COLORS[0].value, start_date: "", end_date: "" });
        // Optimistic: rely on revalidation
      } catch (e) {
        setPhaseError(e instanceof Error ? e.message : "Failed to create phase");
      }
    });
  }

  function handleUpdatePhase() {
    if (!editingPhase) return;
    setPhaseError(null);
    startPhaseTransition(async () => {
      try {
        await updatePhaseAction(slug, editingPhase.id, {
          name: editingPhase.name,
          color: editingPhase.color,
          start_date: editingPhase.start_date,
          end_date: editingPhase.end_date,
        });
        setPhases((prev) => prev.map((p) => (p.id === editingPhase.id ? editingPhase : p)));
        setEditingPhase(null);
      } catch (e) {
        setPhaseError(e instanceof Error ? e.message : "Failed to update phase");
      }
    });
  }

  function handleDeletePhase(phaseId: string) {
    startPhaseTransition(async () => {
      try {
        await deletePhaseAction(slug, phaseId);
        setPhases((prev) => prev.filter((p) => p.id !== phaseId));
      } catch (e) {
        setPhaseError(e instanceof Error ? e.message : "Failed to delete phase");
      }
    });
  }

  function handleAssignPhase(projectId: string, phaseId: string | null) {
    startPhaseTransition(async () => {
      try {
        await assignProjectPhaseAction(slug, projectId, phaseId);
      } catch {
        // silent fail — refresh will show correct state
      }
    });
  }

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Roadmap</h1>
        {isAdmin && (
          <button
            onClick={() => setShowPhasePanel((s) => !s)}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <span className="text-base">◫</span>
            Phases {phases.length > 0 && <span className="ml-1 rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs">{phases.length}</span>}
          </button>
        )}
      </div>

      {/* Phase management panel */}
      {showPhasePanel && isAdmin && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm font-semibold text-neutral-800 mb-4">Manage Phases / Milestones</p>

          {phases.length > 0 && (
            <ul className="space-y-2 mb-4">
              {phases.map((ph) => (
                <li key={ph.id} className="flex items-center gap-3">
                  {editingPhase?.id === ph.id ? (
                    <div className="flex flex-1 items-center gap-2 flex-wrap">
                      <input
                        value={editingPhase.name}
                        onChange={(e) => setEditingPhase({ ...editingPhase, name: e.target.value })}
                        className="rounded border border-neutral-300 px-2 py-1 text-sm flex-1 min-w-32 outline-none focus:border-neutral-900"
                      />
                      <select
                        value={editingPhase.color}
                        onChange={(e) => setEditingPhase({ ...editingPhase, color: e.target.value })}
                        className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none"
                      >
                        {PHASE_COLORS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editingPhase.start_date ?? ""}
                        onChange={(e) => setEditingPhase({ ...editingPhase, start_date: e.target.value || null })}
                        className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none"
                      />
                      <span className="text-neutral-400 text-xs">→</span>
                      <input
                        type="date"
                        value={editingPhase.end_date ?? ""}
                        onChange={(e) => setEditingPhase({ ...editingPhase, end_date: e.target.value || null })}
                        className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none"
                      />
                      <button
                        onClick={handleUpdatePhase}
                        disabled={phasePending}
                        className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                      >Save</button>
                      <button
                        onClick={() => setEditingPhase(null)}
                        className="text-xs text-neutral-400 hover:text-neutral-700"
                      >Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: ph.color }} />
                      <span className="text-sm font-medium text-neutral-800 flex-1">{ph.name}</span>
                      {ph.start_date && (
                        <span className="text-xs text-neutral-400">
                          {new Date(ph.start_date).toLocaleDateString()} – {ph.end_date ? new Date(ph.end_date).toLocaleDateString() : "…"}
                        </span>
                      )}
                      <button
                        onClick={() => setEditingPhase(ph)}
                        className="text-xs text-neutral-400 hover:text-neutral-700"
                      >Edit</button>
                      <button
                        onClick={() => handleDeletePhase(ph.id)}
                        disabled={phasePending}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                      >Delete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* New phase form */}
          <div className="flex items-center gap-2 flex-wrap border-t border-neutral-100 pt-3">
            <input
              value={newPhase.name}
              onChange={(e) => setNewPhase((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreatePhase(); }}
              placeholder="Phase name (e.g. Alpha, Q3 Launch)"
              className="flex-1 min-w-40 rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
            />
            <select
              value={newPhase.color}
              onChange={(e) => setNewPhase((p) => ({ ...p, color: e.target.value }))}
              className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none"
            >
              {PHASE_COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={newPhase.start_date}
              onChange={(e) => setNewPhase((p) => ({ ...p, start_date: e.target.value }))}
              className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none"
            />
            <span className="text-neutral-400 text-xs">→</span>
            <input
              type="date"
              value={newPhase.end_date}
              onChange={(e) => setNewPhase((p) => ({ ...p, end_date: e.target.value }))}
              className="rounded border border-neutral-300 px-2 py-1 text-sm outline-none"
            />
            <button
              onClick={handleCreatePhase}
              disabled={phasePending || !newPhase.name.trim()}
              className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >+ Add Phase</button>
          </div>
          {phaseError && <p className="mt-2 text-xs text-red-600">{phaseError}</p>}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        {/* Phase swimlane bands (shown at top if phases exist) */}
        {phases.length > 0 && (
          <div className="flex border-b border-neutral-200 bg-neutral-50">
            <div className="w-48 shrink-0 border-r border-neutral-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Phases
            </div>
            <div className="relative flex-1 h-8">
              {monthHeaders.map((m) => (
                <div
                  key={`phase-line-${m.label}`}
                  className="absolute top-0 bottom-0 border-l border-neutral-200"
                  style={{ left: `${m.pct}%` }}
                />
              ))}
              {phases.map((ph) => {
                // Position phase band by date if available, otherwise spread evenly
                const now = new Date();
                const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
                const rangeEnd = now.getTime() + sixMonthsMs;
                let leftPct = 0;
                let widthPct = 100 / Math.max(phases.length, 1);
                if (ph.start_date) {
                  const start = new Date(ph.start_date).getTime();
                  leftPct = Math.max(0, ((start - now.getTime()) / sixMonthsMs) * 100);
                }
                if (ph.start_date && ph.end_date) {
                  const start = new Date(ph.start_date).getTime();
                  const end = new Date(ph.end_date).getTime();
                  widthPct = Math.min(100 - leftPct, ((end - start) / sixMonthsMs) * 100);
                }
                return (
                  <div
                    key={ph.id}
                    className="absolute top-1.5 h-5 rounded flex items-center px-2 text-[10px] font-bold text-white whitespace-nowrap overflow-hidden"
                    style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 8)}%`, background: ph.color, opacity: 0.85 }}
                    title={ph.name}
                  >
                    {ph.name}
                  </div>
                );
                void rangeEnd;
              })}
            </div>
          </div>
        )}

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

        {/* Gantt rows + SVG arc overlay */}
        <div ref={ganttRef} className="relative">
        {arcPaths.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible z-10"
            style={{ width: "100%", height: "100%" }}
          >
            <defs>
              <marker id="dep-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M 0 0 L 7 3.5 L 0 7 Z" fill="#f59e0b" />
              </marker>
            </defs>
            {arcPaths.map((a) => (
              <path
                key={a.key}
                d={a.path}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#dep-arrow)"
                opacity="0.7"
              />
            ))}
          </svg>
        )}
        {projects.map((project) => {
          const counts = issueCounts[project.id] ?? { todo: 0, in_progress: 0, done: 0, total: 0 };
          const pct = positions[project.id] ?? 0;
          const w = widths[project.id] ?? 10;
          const barColor = getBarColor(project.status);
          const isExpanded = drillId === project.id;
          const donePct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
          const assignedPhase = phases.find((ph) => ph.id === project.phase_id);

          return (
            <div key={project.id} data-row-id={project.id} className="border-b border-neutral-100 last:border-0">
              <div className="flex items-stretch">
                {/* Left column */}
                <div className="w-48 shrink-0 border-r border-neutral-100 px-4 py-3">
                  <button
                    className="w-full text-left"
                    onClick={() => setDrillId(isExpanded ? null : project.id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                        {project.key}
                      </span>
                      {assignedPhase && (
                        <span
                          className="text-[9px] font-bold rounded px-1 py-0.5 text-white truncate max-w-16"
                          style={{ background: assignedPhase.color }}
                          title={assignedPhase.name}
                        >
                          {assignedPhase.name}
                        </span>
                      )}
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
                  {isAdmin && phases.length > 0 && (
                    <select
                      value={project.phase_id ?? ""}
                      onChange={(e) => handleAssignPhase(project.id, e.target.value || null)}
                      className="mt-1.5 w-full rounded border border-neutral-200 px-1 py-0.5 text-[10px] text-neutral-500 outline-none hover:border-neutral-400"
                      title="Assign to phase"
                    >
                      <option value="">No phase</option>
                      {phases.map((ph) => (
                        <option key={ph.id} value={ph.id}>{ph.name}</option>
                      ))}
                    </select>
                  )}
                </div>

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
                    data-bar-id={project.id}
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
        </div> {/* end ganttRef wrapper */}
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
