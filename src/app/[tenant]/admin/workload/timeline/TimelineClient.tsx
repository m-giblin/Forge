"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";

// ─── Public types (used by server page) ──────────────────────────────────────

export type TLIssue = {
  id: string;
  key: string;
  title: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  projectId: string;
  projectKey: string;
  projectName: string;
  storyPoints: number | null;
  timeEstimateMinutes: number | null;
};

export type TLMember = {
  userId: string;
  name: string;
  initials: string;
  hoursPerWeek: number;
};

export type TLSprint = {
  id: string;
  name: string;
  projectId: string;
  startDate: string | null;
  endDate: string | null;
  status: "planned" | "active" | "completed";
};

export type TLDependency = {
  id: string;
  fromIssueId: string;
  toIssueId: string;
  type: "blocks" | "relates_to";
};

export type TLBaselineItem = {
  issueId: string;
  startDate: string | null;
  dueDate: string | null;
};

export type TLBaseline = {
  id: string;
  name: string;
  createdAt: string;
  items: TLBaselineItem[];
};

// ─── Internal types ───────────────────────────────────────────────────────────

type DragState = {
  type: "move" | "resize-r" | "resize-l";
  issueIds: string[];
  startPageX: number;
  startMemberIdx: number;
  currentMemberIdx: number;
  deltaDays: number;
  origDates: Map<string, { start: string | null; due: string | null }>;
  origAssignees: Map<string, string | null>;
};

type PopoverState = {
  issueId: string;
  x: number;
  y: number;
  above: boolean;
};

type DepSearch = {
  issueId: string;
  depType: "blocks" | "relates_to";
  query: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COL_W = 192;
const ROW_H = 88;
const BAR_H = 34;
const BAR_TOP = 14;
const BASELINE_TOP = BAR_TOP + BAR_H + 4;
const BASELINE_H = 8;
const HEADER_H = 64;
const HANDLE_W = 8;

const PROJECT_COLORS = [
  { bg: "#eef2ff", border: "#818cf8", text: "#3730a3", hex: "#6366f1" },
  { bg: "#f5f3ff", border: "#a78bfa", text: "#4c1d95", hex: "#8b5cf6" },
  { bg: "#f0fdfa", border: "#2dd4bf", text: "#134e4a", hex: "#14b8a6" },
  { bg: "#fffbeb", border: "#fbbf24", text: "#78350f", hex: "#f59e0b" },
  { bg: "#fff1f2", border: "#fb7185", text: "#881337", hex: "#f43f5e" },
  { bg: "#ecfdf5", border: "#34d399", text: "#064e3b", hex: "#10b981" },
  { bg: "#f0f9ff", border: "#38bdf8", text: "#0c4a6e", hex: "#0ea5e9" },
  { bg: "#fff7ed", border: "#fb923c", text: "#7c2d12", hex: "#f97316" },
];

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog", todo: "To Do", in_progress: "In Progress",
  in_review: "In Review", done: "Done",
};

const STATUS_DOT: Record<string, string> = {
  backlog: "#94a3b8", todo: "#64748b", in_progress: "#6366f1",
  in_review: "#f59e0b", done: "#10b981",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#6366f1", low: "#94a3b8",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toUTCDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() - (day === 0 ? 6 : day - 1));
  return copy;
}

// ─── Project color map ────────────────────────────────────────────────────────

function buildColorMap(issues: TLIssue[]) {
  const ids = [...new Set(issues.map((i) => i.projectId))];
  const m = new Map<string, typeof PROJECT_COLORS[0]>();
  ids.forEach((id, i) => m.set(id, PROJECT_COLORS[i % PROJECT_COLORS.length]));
  return m;
}

// ─── Critical path (CPM) ─────────────────────────────────────────────────────

function computeCriticalPath(issues: TLIssue[], deps: TLDependency[]): Set<string> {
  const blocksDeps = deps.filter((d) => d.type === "blocks");
  if (blocksDeps.length === 0) return new Set();

  const issueMap = new Map(
    issues.filter((i) => i.startDate && i.dueDate).map((i) => [i.id, i])
  );
  if (issueMap.size === 0) return new Set();

  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  for (const dep of blocksDeps) {
    if (!issueMap.has(dep.fromIssueId) || !issueMap.has(dep.toIssueId)) continue;
    if (!successors.has(dep.fromIssueId)) successors.set(dep.fromIssueId, []);
    successors.get(dep.fromIssueId)!.push(dep.toIssueId);
    if (!predecessors.has(dep.toIssueId)) predecessors.set(dep.toIssueId, []);
    predecessors.get(dep.toIssueId)!.push(dep.fromIssueId);
  }

  const getDur = (id: string) => {
    const i = issueMap.get(id);
    if (!i?.startDate || !i?.dueDate) return 1;
    return diffDays(toUTCDate(i.startDate), toUTCDate(i.dueDate)) + 1;
  };

  // Forward pass: earliest finish time (days from epoch)
  const eft = new Map<string, number>();
  const computeEFT = (id: string, visited = new Set<string>()): number => {
    if (eft.has(id)) return eft.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    const issue = issueMap.get(id);
    if (!issue?.dueDate) return 0;
    const myDue = Math.floor(toUTCDate(issue.dueDate).getTime() / 86400000);
    const preds = predecessors.get(id) ?? [];
    let latestPredEFT = 0;
    for (const predId of preds) latestPredEFT = Math.max(latestPredEFT, computeEFT(predId, visited));
    const result = Math.max(myDue, latestPredEFT + getDur(id));
    eft.set(id, result);
    return result;
  };
  for (const id of issueMap.keys()) computeEFT(id);

  const projectEnd = Math.max(...eft.values(), 0);

  // Critical: any issue whose EFT chain reaches project end
  const isCritical = (id: string, visited = new Set<string>()): boolean => {
    if (visited.has(id)) return false;
    visited.add(id);
    if (eft.get(id) === projectEnd) return true;
    return (successors.get(id) ?? []).some((s) => isCritical(s, visited));
  };

  const critical = new Set<string>();
  for (const id of issueMap.keys()) {
    if (isCritical(id)) critical.add(id);
  }
  return critical;
}

// ─── Capacity helpers ─────────────────────────────────────────────────────────

function weeklyLoadMinutes(memberId: string, issues: TLIssue[], windowStart: Date): number {
  const weekEnd = addDays(windowStart, 6);
  return issues
    .filter((i) => {
      if (i.assigneeId !== memberId || !i.startDate || !i.dueDate) return false;
      const s = toUTCDate(i.startDate);
      const e = toUTCDate(i.dueDate);
      return s <= weekEnd && e >= windowStart;
    })
    .reduce((sum, i) => sum + (i.timeEstimateMinutes ?? 0), 0);
}

function capacityRingColor(loadMin: number, capacityMin: number) {
  if (capacityMin === 0) return "#94a3b8";
  const pct = loadMin / capacityMin;
  if (pct > 1.1) return "#ef4444";
  if (pct > 0.9) return "#f59e0b";
  return "#10b981";
}

// ─── Dependency arrows SVG ────────────────────────────────────────────────────

function DependencyArrows({
  deps, issues, windowStart, dayWidth, members, criticalSet,
}: {
  deps: TLDependency[];
  issues: TLIssue[];
  windowStart: Date;
  dayWidth: number;
  members: TLMember[];
  criticalSet: Set<string>;
}) {
  const issueMap = new Map(issues.map((i) => [i.id, i]));
  const memberIdx = new Map(members.map((m, i) => [m.userId, i]));
  const arrows: { path: string; color: string; key: string; isCritical: boolean }[] = [];

  for (const dep of deps) {
    const from = issueMap.get(dep.fromIssueId);
    const to = issueMap.get(dep.toIssueId);
    if (!from?.startDate || !from?.dueDate || !to?.startDate || !to?.dueDate) continue;
    if (!from.assigneeId || !to.assigneeId) continue;
    const fromRow = memberIdx.get(from.assigneeId);
    const toRow = memberIdx.get(to.assigneeId);
    if (fromRow === undefined || toRow === undefined) continue;

    const fromLeft = diffDays(windowStart, toUTCDate(from.startDate)) * dayWidth;
    const fromW = (diffDays(toUTCDate(from.startDate), toUTCDate(from.dueDate)) + 1) * dayWidth;
    const toLeft = diffDays(windowStart, toUTCDate(to.startDate)) * dayWidth;

    const ax = fromLeft + fromW;
    const ay = fromRow * ROW_H + BAR_TOP + BAR_H / 2 + HEADER_H;
    const bx = toLeft;
    const by = toRow * ROW_H + BAR_TOP + BAR_H / 2 + HEADER_H;

    const cpOffset = Math.max(40, Math.abs(bx - ax) * 0.4);
    const path = `M ${ax} ${ay} C ${ax + cpOffset} ${ay} ${bx - cpOffset} ${by} ${bx} ${by}`;

    const onCritical = criticalSet.has(dep.fromIssueId) && criticalSet.has(dep.toIssueId);
    const conflict = toUTCDate(from.dueDate) > toUTCDate(to.startDate);
    const color = dep.type === "relates_to"
      ? "#94a3b8"
      : onCritical
        ? "#f97316"
        : conflict
          ? "#ef4444"
          : "#10b981";

    arrows.push({ path, color, key: dep.id, isCritical: onCritical });
  }

  if (arrows.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        {["green", "red", "orange", "gray"].map((c) => (
          <marker key={c} id={`arrow-${c}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={c === "green" ? "#10b981" : c === "red" ? "#ef4444" : c === "orange" ? "#f97316" : "#94a3b8"} />
          </marker>
        ))}
      </defs>
      {arrows.map(({ path, color, key, isCritical }) => {
        const markerId = color === "#ef4444" ? "arrow-red" : color === "#f97316" ? "arrow-orange" : color === "#94a3b8" ? "arrow-gray" : "arrow-green";
        return (
          <path
            key={key}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={isCritical ? 2 : 1.5}
            strokeDasharray={color === "#94a3b8" ? "4 3" : undefined}
            markerEnd={`url(#${markerId})`}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

// ─── Edit popover ─────────────────────────────────────────────────────────────

function EditPopover({
  issue, allIssues, members, deps, slug, onClose, onUpdate, onDepAdded, onDepRemoved, style,
}: {
  issue: TLIssue;
  allIssues: TLIssue[];
  members: TLMember[];
  deps: TLDependency[];
  slug: string;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<TLIssue>) => void;
  onDepAdded: (dep: TLDependency) => void;
  onDepRemoved: (depId: string) => void;
  style: React.CSSProperties;
}) {
  const myDeps = deps.filter((d) => d.fromIssueId === issue.id || d.toIssueId === issue.id);
  const [depSearch, setDepSearch] = useState<DepSearch | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = useCallback(async (fields: Partial<TLIssue>) => {
    onUpdate(issue.id, fields);
    const body: Record<string, unknown> = { slug };
    if (fields.status !== undefined || fields.priority !== undefined) {
      const v1Body: Record<string, unknown> = {};
      if (fields.status !== undefined) v1Body.status = fields.status;
      if (fields.priority !== undefined) v1Body.priority = fields.priority;
      await fetch(`/api/v1/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v1Body),
      }).catch(console.error);
    }
    if (fields.assigneeId !== undefined || fields.startDate !== undefined || fields.dueDate !== undefined) {
      if (fields.assigneeId !== undefined) body.assignee_id = fields.assigneeId;
      if (fields.startDate !== undefined) body.start_date = fields.startDate;
      if (fields.dueDate !== undefined) body.due_date = fields.dueDate;
      await fetch(`/api/issues/${issue.id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(console.error);
    }
  }, [issue.id, slug, onUpdate]);

  const addDep = useCallback(async (toIssueId: string, type: "blocks" | "relates_to") => {
    setSaving(true);
    const res = await fetch(`/api/issues/${issue.id}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, to_issue_id: toIssueId, type }),
    });
    if (res.ok) {
      const { dependency } = await res.json();
      onDepAdded({ id: dependency.id, fromIssueId: dependency.from_issue_id, toIssueId: dependency.to_issue_id, type: dependency.type });
      setDepSearch(null);
    }
    setSaving(false);
  }, [issue.id, slug, onDepAdded]);

  const removeDep = useCallback(async (dep: TLDependency) => {
    await fetch(`/api/issues/${dep.fromIssueId}/dependencies`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, to_issue_id: dep.toIssueId, type: dep.type }),
    }).catch(console.error);
    onDepRemoved(dep.id);
  }, [slug, onDepRemoved]);

  const searchResults = depSearch
    ? allIssues
        .filter((i) =>
          i.id !== issue.id &&
          !myDeps.some((d) => d.toIssueId === i.id || d.fromIssueId === i.id) &&
          (i.key.toLowerCase().includes(depSearch.query.toLowerCase()) ||
            i.title.toLowerCase().includes(depSearch.query.toLowerCase()))
        )
        .slice(0, 6)
    : [];

  return (
    <div className="absolute z-[200] w-80 rounded-xl border border-neutral-200 bg-white shadow-2xl" style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-neutral-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono font-semibold text-neutral-400">{issue.key}</span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "#f1f5f9", color: STATUS_DOT[issue.status] }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: STATUS_DOT[issue.status] }} />
              {STATUS_LABELS[issue.status]}
            </span>
          </div>
          <p className="text-sm font-semibold text-neutral-900 leading-snug truncate">{issue.title}</p>
        </div>
        <button onClick={onClose} className="shrink-0 text-neutral-400 hover:text-neutral-700 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">Status</label>
            <select value={issue.status} onChange={(e) => patch({ status: e.target.value as TLIssue["status"] })} className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">Priority</label>
            <select value={issue.priority} onChange={(e) => patch({ priority: e.target.value as TLIssue["priority"] })} className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {["urgent", "high", "medium", "low"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-500 mb-1">Assignee</label>
          <select value={issue.assigneeId ?? ""} onChange={(e) => patch({ assigneeId: e.target.value || null })} className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">Start date</label>
            <input type="date" value={issue.startDate ?? ""} onChange={(e) => patch({ startDate: e.target.value || null })} className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">Due date</label>
            <input type="date" value={issue.dueDate ?? ""} onChange={(e) => patch({ dueDate: e.target.value || null })} className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-100 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Dependencies</span>
          <button onClick={() => setDepSearch({ issueId: issue.id, depType: "blocks", query: "" })} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Link</button>
        </div>
        {myDeps.length === 0 && !depSearch && <p className="text-xs text-neutral-400">None — link issues to show arrows on the timeline.</p>}
        {myDeps.map((dep) => {
          const other = dep.fromIssueId === issue.id
            ? allIssues.find((i) => i.id === dep.toIssueId)
            : allIssues.find((i) => i.id === dep.fromIssueId);
          const label = dep.fromIssueId === issue.id
            ? dep.type === "blocks" ? "Blocks" : "Relates to"
            : dep.type === "blocks" ? "Blocked by" : "Relates to";
          return (
            <div key={dep.id} className="flex items-center justify-between py-1 group">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-medium text-neutral-400 shrink-0">{label}</span>
                <span className="text-xs font-mono text-indigo-700 shrink-0">{other?.key}</span>
                <span className="text-xs text-neutral-600 truncate">{other?.title}</span>
              </div>
              <button onClick={() => removeDep(dep)} className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-500 ml-2 shrink-0 transition">✕</button>
            </div>
          );
        })}
        {depSearch && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <select value={depSearch.depType} onChange={(e) => setDepSearch((s) => s && { ...s, depType: e.target.value as "blocks" | "relates_to" })} className="rounded border border-neutral-200 px-1.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400">
                <option value="blocks">Blocks</option>
                <option value="relates_to">Relates to</option>
              </select>
              <input autoFocus type="text" placeholder="Search issues…" value={depSearch.query} onChange={(e) => setDepSearch((s) => s && { ...s, query: e.target.value })} className="flex-1 rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <button onClick={() => setDepSearch(null)} className="text-neutral-300 hover:text-neutral-600">✕</button>
            </div>
            {searchResults.length > 0 && (
              <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
                {searchResults.map((r) => (
                  <button key={r.id} disabled={saving} onClick={() => addDep(r.id, depSearch.depType)} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 text-left transition">
                    <span className="text-[11px] font-mono text-indigo-600 shrink-0">{r.key}</span>
                    <span className="text-xs text-neutral-700 truncate">{r.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-100 px-4 py-2.5">
        <Link href={`/${slug}/issues/${issue.id}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium" onClick={onClose}>Open full issue →</Link>
      </div>
    </div>
  );
}

// ─── Unscheduled tray ─────────────────────────────────────────────────────────

function UnscheduledTray({ issues, colorMap, onSchedule }: {
  issues: TLIssue[];
  colorMap: Map<string, typeof PROJECT_COLORS[0]>;
  onSchedule: (id: string) => void;
}) {
  if (issues.length === 0) return null;
  return (
    <div className="border-t border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Unscheduled ({issues.length})</span>
        <span className="text-[11px] text-neutral-400">— click to assign dates</span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {issues.map((issue) => {
          const color = colorMap.get(issue.projectId) ?? PROJECT_COLORS[0];
          return (
            <button key={issue.id} onClick={() => onSchedule(issue.id)} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:shadow-sm" style={{ background: color.bg, borderColor: color.border, color: color.text }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[issue.status] }} />
              <span className="font-mono">{issue.key}</span>
              <span className="max-w-[160px] truncate text-neutral-600">{issue.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TimelineClient({
  slug,
  members,
  issues: initialIssues,
  sprints,
  dependencies: initialDeps,
  initialBaselines = [],
}: {
  slug: string;
  members: TLMember[];
  issues: TLIssue[];
  sprints: TLSprint[];
  dependencies: TLDependency[];
  initialBaselines?: TLBaseline[];
}) {
  const [issues, setIssues] = useState<TLIssue[]>(initialIssues);
  const [deps, setDeps] = useState<TLDependency[]>(initialDeps);
  const [baselines, setBaselines] = useState<TLBaseline[]>(initialBaselines);
  const [zoom, setZoom] = useState<"week" | "month">("week");
  const [windowOffset, setWindowOffset] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [highlightRow, setHighlightRow] = useState<number | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [activeBaselineId, setActiveBaselineId] = useState<string | null>(null);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineNameInput, setBaselineNameInput] = useState("");
  const [showBaselineSave, setShowBaselineSave] = useState(false);

  const dragRef = useRef<DragState | null>(null);
  const barRefs = useRef<Map<string, HTMLElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  const colorMap = useMemo(() => buildColorMap(issues), [issues]);

  const dayWidth = zoom === "week" ? 38 : 14;
  const WINDOW_DAYS = 84;

  const windowStartIso = useMemo(() => {
    const base = mondayOf(addDays(new Date(), -14));
    base.setUTCHours(0, 0, 0, 0);
    return toIso(addDays(base, windowOffset * 7));
  }, [windowOffset]);
  const windowStart = useMemo(() => toUTCDate(windowStartIso), [windowStartIso]);
  const windowEnd = addDays(windowStart, WINDOW_DAYS);
  const totalWidth = WINDOW_DAYS * dayWidth;
  const totalHeight = HEADER_H + members.length * ROW_H;

  const scheduled = issues.filter((i) => i.startDate && i.dueDate);
  const unscheduled = issues.filter((i) => !i.startDate || !i.dueDate);

  // Critical path
  const criticalPathSet = useMemo(() => {
    if (!showCriticalPath) return new Set<string>();
    return computeCriticalPath(issues, deps);
  }, [issues, deps, showCriticalPath]);

  // Active baseline item map
  const activeBaselineMap = useMemo(() => {
    const bl = baselines.find((b) => b.id === activeBaselineId);
    if (!bl) return new Map<string, TLBaselineItem>();
    return new Map(bl.items.map((item) => [item.issueId, item]));
  }, [baselines, activeBaselineId]);

  function barLeft(issue: TLIssue): number {
    if (!issue.startDate) return 0;
    return diffDays(windowStart, toUTCDate(issue.startDate)) * dayWidth;
  }

  function barWidth(issue: TLIssue): number {
    if (!issue.startDate || !issue.dueDate) return 0;
    return Math.max(dayWidth, (diffDays(toUTCDate(issue.startDate), toUTCDate(issue.dueDate)) + 1) * dayWidth);
  }

  const weekHeaders: { date: Date; label: string; isToday: boolean }[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let w = 0; w < WINDOW_DAYS / 7; w++) {
    const d = addDays(windowStart, w * 7);
    const isToday = d <= today && today < addDays(d, 7);
    weekHeaders.push({ date: d, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), isToday });
  }

  const sprintBands = sprints
    .filter((s) => s.startDate && s.endDate)
    .map((s) => {
      const left = Math.max(0, diffDays(windowStart, toUTCDate(s.startDate!)) * dayWidth);
      const right = Math.min(totalWidth, (diffDays(windowStart, toUTCDate(s.endDate!)) + 1) * dayWidth);
      return { ...s, left, width: Math.max(0, right - left) };
    })
    .filter((s) => s.width > 0);

  const memberLoad = members.map((m) => ({
    userId: m.userId,
    loadMin: weeklyLoadMinutes(m.userId, issues, windowStart),
    capacityMin: m.hoursPerWeek * 60,
  }));

  const memberRowFromY = useCallback((clientY: number): number => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    const relY = clientY - rect.top - HEADER_H;
    if (relY < 0) return 0;
    return Math.min(members.length - 1, Math.floor(relY / ROW_H));
  }, [members.length]);

  const onBarMouseDown = useCallback((e: React.MouseEvent, issueId: string, dragType: "move" | "resize-r" | "resize-l") => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setPopover(null);
    let ids: string[];
    if (e.shiftKey) {
      setSelection((prev) => {
        const next = new Set(prev);
        if (next.has(issueId)) next.delete(issueId); else next.add(issueId);
        ids = [...next];
        return next;
      });
      return;
    } else {
      ids = selection.has(issueId) ? [...selection] : [issueId];
      if (!selection.has(issueId)) setSelection(new Set([issueId]));
    }
    const origDates = new Map<string, { start: string | null; due: string | null }>();
    const origAssignees = new Map<string, string | null>();
    for (const id of ids) {
      const issue = issues.find((i) => i.id === id);
      if (issue) {
        origDates.set(id, { start: issue.startDate, due: issue.dueDate });
        origAssignees.set(id, issue.assigneeId);
      }
    }
    dragRef.current = { type: dragType, issueIds: ids, startPageX: e.pageX, startMemberIdx: memberRowFromY(e.clientY), currentMemberIdx: memberRowFromY(e.clientY), deltaDays: 0, origDates, origAssignees };
  }, [issues, selection, memberRowFromY]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaPx = e.pageX - drag.startPageX;
      drag.deltaDays = Math.round(deltaPx / dayWidth);
      const rowIdx = memberRowFromY(e.clientY);
      drag.currentMemberIdx = rowIdx;
      setHighlightRow(rowIdx);

      for (const id of drag.issueIds) {
        const el = barRefs.current.get(id);
        if (!el) continue;
        const orig = drag.origDates.get(id);
        if (!orig) continue;
        if (drag.type === "move") {
          el.style.transform = `translateX(${drag.deltaDays * dayWidth}px)`;
        } else if (drag.type === "resize-r") {
          const origW = orig.start && orig.due ? (diffDays(toUTCDate(orig.start), toUTCDate(orig.due)) + 1) * dayWidth : dayWidth;
          el.style.width = `${Math.max(dayWidth, origW + drag.deltaDays * dayWidth)}px`;
        } else if (drag.type === "resize-l") {
          const origLeft = orig.start ? diffDays(windowStart, toUTCDate(orig.start)) * dayWidth : 0;
          const origW = orig.start && orig.due ? (diffDays(toUTCDate(orig.start), toUTCDate(orig.due)) + 1) * dayWidth : dayWidth;
          el.style.left = `${origLeft + drag.deltaDays * dayWidth}px`;
          el.style.width = `${Math.max(dayWidth, origW - drag.deltaDays * dayWidth)}px`;
        }
        el.style.opacity = "0.85";
        el.style.zIndex = "40";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      }
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const { type, issueIds, deltaDays, currentMemberIdx, origDates, origAssignees } = drag;
      const newMember = members[currentMemberIdx];
      for (const id of issueIds) {
        const el = barRefs.current.get(id);
        if (el) { el.style.transform = ""; el.style.width = ""; el.style.left = ""; el.style.opacity = ""; el.style.zIndex = ""; el.style.boxShadow = ""; }
      }
      if (deltaDays !== 0 || (type === "move" && newMember)) {
        setIssues((prev) => prev.map((issue) => {
          if (!issueIds.includes(issue.id)) return issue;
          const orig = origDates.get(issue.id);
          const origAssignee = origAssignees.get(issue.id);
          if (!orig) return issue;
          let newStart = issue.startDate, newDue = issue.dueDate, newAssignee = issue.assigneeId;
          if (type === "move") {
            newStart = orig.start ? toIso(addDays(toUTCDate(orig.start), deltaDays)) : null;
            newDue = orig.due ? toIso(addDays(toUTCDate(orig.due), deltaDays)) : null;
            newAssignee = newMember?.userId ?? origAssignee ?? null;
          } else if (type === "resize-r") {
            newDue = orig.due ? toIso(addDays(toUTCDate(orig.due), deltaDays)) : null;
            if (newDue && newStart && newDue < newStart) newDue = newStart;
          } else if (type === "resize-l") {
            newStart = orig.start ? toIso(addDays(toUTCDate(orig.start), deltaDays)) : null;
            if (newStart && newDue && newStart > newDue) newStart = newDue;
          }
          return { ...issue, startDate: newStart, dueDate: newDue, assigneeId: newAssignee };
        }));
        for (const id of issueIds) {
          const orig = origDates.get(id);
          const origAssignee = origAssignees.get(id);
          if (!orig) continue;
          const body: Record<string, unknown> = { slug };
          if (type === "move") {
            body.start_date = orig.start ? toIso(addDays(toUTCDate(orig.start), deltaDays)) : null;
            body.due_date = orig.due ? toIso(addDays(toUTCDate(orig.due), deltaDays)) : null;
            body.assignee_id = newMember?.userId ?? origAssignee ?? null;
          } else if (type === "resize-r") {
            body.due_date = orig.due ? toIso(addDays(toUTCDate(orig.due), deltaDays)) : null;
          } else if (type === "resize-l") {
            body.start_date = orig.start ? toIso(addDays(toUTCDate(orig.start), deltaDays)) : null;
          }
          fetch(`/api/issues/${id}/schedule`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(console.error);
        }
      }
      dragRef.current = null;
      setHighlightRow(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dayWidth, members, memberRowFromY, slug, windowStart]);

  const onBarClick = useCallback((e: React.MouseEvent, issue: TLIssue) => {
    if (dragRef.current) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = gridRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const x = rect.left - containerRect.left;
    const y = rect.top - containerRect.top;
    setPopover({ issueId: issue.id, x, y, above: y > totalHeight / 2 });
  }, [totalHeight]);

  const onScheduleUnscheduled = useCallback((id: string) => {
    const startDate = windowStartIso;
    const dueDate = toIso(addDays(toUTCDate(windowStartIso), 4));
    setPopover({ issueId: id, x: 200, y: HEADER_H, above: false });
    setIssues((prev) => prev.map((i) => i.id === id ? { ...i, startDate, dueDate } : i));
    fetch(`/api/issues/${id}/schedule`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, start_date: startDate, due_date: dueDate }) }).catch(console.error);
  }, [slug, windowStartIso]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPopover(null); setSelection(new Set()); setShowBaselineSave(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleUpdate = useCallback((id: string, patch: Partial<TLIssue>) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);
  const handleDepAdded = useCallback((dep: TLDependency) => { setDeps((prev) => [...prev, dep]); }, []);
  const handleDepRemoved = useCallback((depId: string) => { setDeps((prev) => prev.filter((d) => d.id !== depId)); }, []);

  const handleSaveBaseline = useCallback(async () => {
    const name = baselineNameInput.trim() || `Baseline ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    setSavingBaseline(true);
    const res = await fetch("/api/issues/baselines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name }),
    });
    if (res.ok) {
      const data = await res.json();
      const newBaseline: TLBaseline = {
        id: data.baseline.id,
        name,
        createdAt: new Date().toISOString(),
        items: data.baseline.items.map((item: { issue_id: string; start_date: string; due_date: string }) => ({
          issueId: item.issue_id,
          startDate: item.start_date,
          dueDate: item.due_date,
        })),
      };
      setBaselines((prev) => [newBaseline, ...prev]);
      setActiveBaselineId(newBaseline.id);
    }
    setSavingBaseline(false);
    setShowBaselineSave(false);
    setBaselineNameInput("");
  }, [slug, baselineNameInput]);

  const popoverIssue = popover ? issues.find((i) => i.id === popover.issueId) : null;
  const today2 = new Date();
  today2.setUTCHours(0, 0, 0, 0);
  const todayLeft = diffDays(windowStart, today2) * dayWidth;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white" onClick={() => { setPopover(null); setSelection(new Set()); setShowBaselineSave(false); }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-neutral-900">Allocation Timeline</h1>
          {selection.size > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {selection.size} selected — drag to move all
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Critical Path toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowCriticalPath((v) => !v); }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${showCriticalPath ? "bg-orange-500 border-orange-500 text-white" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
          >
            <span>🔴</span> Critical Path
          </button>

          {/* Baseline controls */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <select
              value={activeBaselineId ?? ""}
              onChange={(e) => setActiveBaselineId(e.target.value || null)}
              className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">No baseline</option>
              {baselines.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowBaselineSave(true)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition"
            >
              📌 Save baseline
            </button>
          </div>

          {/* Zoom */}
          <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-xs">
            {(["week", "month"] as const).map((z) => (
              <button key={z} onClick={(e) => { e.stopPropagation(); setZoom(z); }} className={`px-3 py-1.5 font-medium transition ${zoom === z ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}>
                {z === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>

          {/* Window navigation */}
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setWindowOffset((o) => o - 4); }} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition">←</button>
            <button onClick={(e) => { e.stopPropagation(); setWindowOffset(0); }} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition">Today</button>
            <button onClick={(e) => { e.stopPropagation(); setWindowOffset((o) => o + 4); }} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition">→</button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 border border-indigo-400 inline-block" /> Current</span>
            {activeBaselineId && <span className="flex items-center gap-1"><span className="w-6 h-1.5 rounded-sm border border-dashed border-neutral-400 inline-block bg-transparent" /> Baseline</span>}
            {showCriticalPath && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Critical</span>}
          </div>
        </div>
      </div>

      {/* Baseline save dialog */}
      {showBaselineSave && (
        <div className="px-6 py-3 border-b border-amber-200 bg-amber-50 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <span className="text-sm font-medium text-amber-800">Name this baseline:</span>
          <input
            autoFocus
            type="text"
            value={baselineNameInput}
            onChange={(e) => setBaselineNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveBaseline(); if (e.key === "Escape") { setShowBaselineSave(false); setBaselineNameInput(""); } }}
            placeholder={`Baseline ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white w-64"
          />
          <button onClick={handleSaveBaseline} disabled={savingBaseline} className="rounded-lg bg-amber-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition">
            {savingBaseline ? "Saving…" : "Save"}
          </button>
          <button onClick={() => { setShowBaselineSave(false); setBaselineNameInput(""); }} className="text-amber-600 hover:text-amber-800 text-sm">Cancel</button>
        </div>
      )}

      {/* Timeline grid */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-x-auto overflow-y-auto relative" ref={gridRef}>
          <div style={{ minWidth: COL_W + totalWidth, position: "relative" }}>

            {/* Header */}
            <div className="flex" style={{ height: HEADER_H }}>
              <div className="shrink-0 border-r border-b border-neutral-200 bg-neutral-50 flex items-end px-4 pb-2" style={{ width: COL_W, position: "sticky", left: 0, zIndex: 20 }}>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Team</span>
              </div>
              <div className="relative border-b border-neutral-200 flex-1" style={{ width: totalWidth }}>
                {sprintBands.map((s) => (
                  <div key={s.id} className="absolute top-0 flex items-center px-2 overflow-hidden" style={{ left: s.left, width: s.width, height: 22, background: s.status === "active" ? "#eef2ff" : "#f8fafc", borderRight: "1px solid #e2e8f0" }}>
                    <span className="text-[10px] font-semibold truncate" style={{ color: s.status === "active" ? "#4f46e5" : "#94a3b8" }}>
                      {s.status === "active" ? "● " : ""}{s.name}
                    </span>
                  </div>
                ))}
                <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: 42 }}>
                  {weekHeaders.map((wh, i) => (
                    <div key={i} className="border-r border-neutral-100 flex items-center px-2 shrink-0" style={{ width: dayWidth * 7, background: wh.isToday ? "#fefce8" : "transparent" }}>
                      <span className={`text-[11px] font-medium ${wh.isToday ? "text-amber-700 font-semibold" : "text-neutral-500"}`}>{wh.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Member rows */}
            {members.map((member, rowIdx) => {
              const memberIssues = scheduled.filter((i) => i.assigneeId === member.userId);
              const load = memberLoad.find((l) => l.userId === member.userId);
              const ringColor = capacityRingColor(load?.loadMin ?? 0, load?.capacityMin ?? 2400);
              const loadPct = load && load.capacityMin > 0 ? Math.round((load.loadMin / load.capacityMin) * 100) : 0;
              const isHighlit = highlightRow === rowIdx;

              return (
                <div key={member.userId} className="flex" style={{ height: ROW_H, borderBottom: "1px solid #f1f5f9" }}>
                  <div className="shrink-0 border-r border-neutral-200 flex items-center gap-2.5 px-4" style={{ width: COL_W, position: "sticky", left: 0, zIndex: 10, background: isHighlit ? "#eef2ff" : "white", transition: "background 0.15s" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ background: ringColor, boxShadow: `0 0 0 2px white, 0 0 0 3px ${ringColor}` }}>
                      {member.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">{member.name}</div>
                      <div className="text-[10px] font-medium" style={{ color: ringColor }}>{loadPct}% · {member.hoursPerWeek}h/wk</div>
                    </div>
                  </div>

                  <div className="relative flex-1" style={{ width: totalWidth, background: isHighlit ? "rgba(238,242,255,0.6)" : rowIdx % 2 === 0 ? "white" : "#fafafa", transition: "background 0.15s" }}>
                    {weekHeaders.map((wh, i) => (
                      <div key={i} className="absolute top-0 bottom-0" style={{ left: i * dayWidth * 7, width: dayWidth * 7, borderRight: "1px solid #f1f5f9", background: wh.isToday ? "rgba(254,252,232,0.4)" : "transparent" }} />
                    ))}

                    {memberIssues.map((issue) => {
                      const left = barLeft(issue);
                      const w = barWidth(issue);
                      if (left > totalWidth || left + w < 0) return null;

                      const color = colorMap.get(issue.projectId) ?? PROJECT_COLORS[0];
                      const isSelected = selection.has(issue.id);
                      const isCritical = showCriticalPath && criticalPathSet.has(issue.id);
                      const isDimmed = showCriticalPath && criticalPathSet.size > 0 && !isCritical;
                      const narrow = w < 80;

                      // Baseline ghost bar
                      const bItem = activeBaselineMap.get(issue.id);
                      const bLeft = bItem?.startDate ? diffDays(windowStart, toUTCDate(bItem.startDate)) * dayWidth : null;
                      const bWidth = bItem?.startDate && bItem?.dueDate
                        ? Math.max(dayWidth, (diffDays(toUTCDate(bItem.startDate), toUTCDate(bItem.dueDate)) + 1) * dayWidth)
                        : null;
                      const driftDays = bItem?.dueDate && issue.dueDate
                        ? diffDays(toUTCDate(bItem.dueDate), toUTCDate(issue.dueDate))
                        : 0;
                      const driftColor = driftDays > 0 ? "#ef4444" : driftDays < 0 ? "#10b981" : "#94a3b8";

                      return (
                        <div key={issue.id}>
                          {/* Baseline ghost bar */}
                          {bLeft !== null && bWidth !== null && activeBaselineId && (
                            <div
                              className="absolute pointer-events-none"
                              title={`Baseline: ${bItem?.startDate} → ${bItem?.dueDate}${driftDays !== 0 ? ` (${driftDays > 0 ? "+" : ""}${driftDays}d drift)` : ""}`}
                              style={{
                                left: bLeft,
                                width: bWidth,
                                top: BASELINE_TOP,
                                height: BASELINE_H,
                                borderRadius: 3,
                                border: `1.5px dashed ${driftColor}`,
                                background: `${driftColor}18`,
                              }}
                            />
                          )}

                          {/* Main bar */}
                          <div
                            ref={(el) => { if (el) barRefs.current.set(issue.id, el); else barRefs.current.delete(issue.id); }}
                            className="absolute select-none cursor-grab active:cursor-grabbing"
                            style={{
                              left,
                              width: w,
                              top: BAR_TOP,
                              height: BAR_H,
                              borderRadius: 6,
                              background: color.bg,
                              border: isCritical
                                ? `2px solid #f97316`
                                : `1.5px solid ${isSelected ? "#6366f1" : color.border}`,
                              borderLeft: `4px solid ${isCritical ? "#f97316" : PRIORITY_COLORS[issue.priority]}`,
                              boxShadow: isCritical
                                ? "0 0 0 2px #fed7aa, 0 2px 8px rgba(249,115,22,0.25)"
                                : isSelected
                                  ? "0 0 0 2px #6366f1, 0 2px 6px rgba(99,102,241,0.2)"
                                  : "0 1px 3px rgba(0,0,0,0.06)",
                              opacity: isDimmed ? 0.3 : 1,
                              transition: "opacity 0.2s, box-shadow 0.1s",
                              overflow: "hidden",
                              zIndex: isSelected || isCritical ? 10 : 5,
                            }}
                            onMouseDown={(e) => onBarMouseDown(e, issue.id, "move")}
                            onClick={(e) => onBarClick(e, issue)}
                          >
                            <div className="flex items-center gap-1.5 h-full px-2 pointer-events-none" style={{ paddingLeft: narrow ? 6 : 10 }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[issue.status] }} />
                              {!narrow && (
                                <>
                                  <span className="text-[11px] font-mono font-semibold shrink-0" style={{ color: color.text }}>{issue.key}</span>
                                  <span className="text-[11px] truncate" style={{ color: "#475569" }}>{issue.title}</span>
                                  {issue.storyPoints && (
                                    <span className="ml-auto shrink-0 text-[10px] font-semibold rounded px-1" style={{ background: color.border + "33", color: color.text }}>{issue.storyPoints}pt</span>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="absolute inset-y-0 left-0 cursor-col-resize" style={{ width: HANDLE_W, zIndex: 20 }} onMouseDown={(e) => { e.stopPropagation(); onBarMouseDown(e, issue.id, "resize-l"); }} />
                            <div className="absolute inset-y-0 right-0 cursor-col-resize" style={{ width: HANDLE_W, zIndex: 20 }} onMouseDown={(e) => { e.stopPropagation(); onBarMouseDown(e, issue.id, "resize-r"); }} />
                          </div>

                          {/* Drift label */}
                          {bLeft !== null && driftDays !== 0 && activeBaselineId && (
                            <div
                              className="absolute pointer-events-none text-[9px] font-semibold"
                              style={{ left: left + w + 2, top: BASELINE_TOP - 1, color: driftColor, zIndex: 6, whiteSpace: "nowrap" }}
                            >
                              {driftDays > 0 ? `+${driftDays}d` : `${driftDays}d`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Today line */}
            {todayLeft >= 0 && todayLeft <= totalWidth && (
              <div className="absolute pointer-events-none" style={{ left: COL_W + todayLeft, top: 0, bottom: 0, width: 2, background: "#f43f5e", zIndex: 30, opacity: 0.6 }}>
                <div className="absolute -top-0 -left-1 w-4 h-4 rounded-full" style={{ background: "#f43f5e", top: HEADER_H - 6, left: -3 }} />
              </div>
            )}

            {/* Dependency arrows */}
            <div className="absolute pointer-events-none" style={{ left: COL_W, top: 0, width: totalWidth, height: totalHeight }}>
              <DependencyArrows deps={deps} issues={issues} windowStart={windowStart} dayWidth={dayWidth} members={members} criticalSet={criticalPathSet} />
            </div>

            {/* Edit popover */}
            {popover && popoverIssue && (
              <div className="absolute" style={{ left: Math.min(popover.x + COL_W, COL_W + totalWidth - 340), top: popover.above ? popover.y - 420 : popover.y + BAR_H + 8, zIndex: 200 }} onClick={(e) => e.stopPropagation()}>
                <EditPopover issue={popoverIssue} allIssues={issues} members={members} deps={deps} slug={slug} onClose={() => setPopover(null)} onUpdate={handleUpdate} onDepAdded={handleDepAdded} onDepRemoved={handleDepRemoved} style={{}} />
              </div>
            )}
          </div>
        </div>

        <UnscheduledTray issues={unscheduled} colorMap={colorMap} onSchedule={onScheduleUnscheduled} />
      </div>
    </div>
  );
}
