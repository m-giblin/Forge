"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

type CanvasIssue = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  assignee_name?: string | null;
};

type Position = { x: number; y: number };

const STATUS_COLOR: Record<string, string> = {
  backlog: "bg-neutral-100 border-neutral-300 text-neutral-500",
  todo: "bg-blue-50 border-blue-200 text-blue-700",
  in_progress: "bg-indigo-50 border-indigo-300 text-indigo-700",
  in_review: "bg-amber-50 border-amber-300 text-amber-700",
  done: "bg-emerald-50 border-emerald-300 text-emerald-700",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-neutral-300",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

const CARD_W = 200;
const CARD_H = 120;

function gridPos(idx: number): Position {
  const cols = 5;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  return { x: 40 + col * (CARD_W + 20), y: 40 + row * (CARD_H + 20) };
}

export default function CanvasTab({
  slug,
  projectKey,
  projectId,
  issues: rawIssues,
}: {
  slug: string;
  projectKey: string;
  projectId: string;
  issues: Array<{
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string;
    assignee_id?: string | null;
  }>;
}) {
  const issues: CanvasIssue[] = rawIssues.map((i) => ({
    id: i.id,
    number: i.number,
    title: i.title,
    status: i.status,
    priority: i.priority,
    assignee_name: null,
  }));

  const storageKey = `forge:canvas:${projectId}`;

  const buildPositions = useCallback((items: CanvasIssue[]): Record<string, Position> => {
    let saved: Record<string, Position> = {};
    if (typeof window !== "undefined") {
      try { saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { /* ignore */ }
    }
    const out: Record<string, Position> = {};
    items.forEach((item, idx) => { out[item.id] = saved[item.id] ?? gridPos(idx); });
    return out;
  }, [storageKey]);

  const [positions, setPositions] = useState<Record<string, Position>>(() => buildPositions(issues));
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const savePositions = useCallback(
    (pos: Record<string, Position>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(pos));
      } catch {
        // storage full — ignore
      }
    },
    [storageKey]
  );

  const onMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const pos = positions[id] ?? { x: 0, y: 0 };
    dragging.current = { id, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    setDraggingId(id);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { id, ox, oy } = dragging.current;
      setPositions((prev) => ({ ...prev, [id]: { x: e.clientX - ox, y: e.clientY - oy } }));
    };
    const onUp = () => {
      if (dragging.current) {
        setPositions((prev) => {
          savePositions(prev);
          return prev;
        });
        dragging.current = null;
        setDraggingId(null);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [savePositions]);

  const resetPositions = () => {
    const reset: Record<string, Position> = {};
    issues.forEach((item, idx) => { reset[item.id] = gridPos(idx); });
    setPositions(reset);
    savePositions(reset);
  };

  const filteredIssues = issues.filter((i) => {
    if (filterStatus === "active") return i.status !== "done";
    if (filterStatus === "all") return true;
    return i.status === filterStatus;
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-neutral-500 font-medium">Filter:</span>
        {[
          { value: "active", label: "Active" },
          { value: "all", label: "All" },
          { value: "todo", label: "Todo" },
          { value: "in_progress", label: "In progress" },
          { value: "in_review", label: "In review" },
          { value: "done", label: "Done" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterStatus(opt.value)}
            className={`rounded-full px-3 py-0.5 text-xs font-medium transition ${
              filterStatus === opt.value
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-neutral-400">{filteredIssues.length} cards</span>
          <button
            onClick={resetPositions}
            className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Reset layout
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-400">Drag cards to rearrange. Positions are saved in your browser.</p>

      {/* Canvas */}
      <div
        className="relative overflow-auto rounded-xl border border-neutral-200 bg-neutral-50"
        style={{ height: 600 }}
      >
        <div className="relative" style={{ width: 1400, height: 800 }}>
          {/* Dot grid */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#9ca3af" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>

          {filteredIssues.map((issue) => {
            const pos = positions[issue.id] ?? { x: 0, y: 0 };
            const colorCls = STATUS_COLOR[issue.status] ?? STATUS_COLOR.backlog;
            const dotCls = PRIORITY_DOT[issue.priority] ?? PRIORITY_DOT.low;
            return (
              <div
                key={issue.id}
                onMouseDown={(e) => onMouseDown(e, issue.id)}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: CARD_W,
                  userSelect: "none",
                  cursor: draggingId === issue.id ? "grabbing" : "grab",
                }}
                className={`rounded-lg border shadow-sm ${colorCls} p-3 text-xs transition-shadow hover:shadow-md`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-mono text-neutral-400 text-[10px]">
                    {projectKey}-{issue.number}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} title={issue.priority} />
                    <span className="text-[10px] font-medium">{STATUS_LABEL[issue.status] ?? issue.status}</span>
                  </div>
                </div>
                <p className="line-clamp-2 font-medium leading-snug text-neutral-800 text-xs">
                  {issue.title}
                </p>
                <Link
                  href={`/${slug}/issues/${issue.id}`}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="mt-2 block text-center rounded border border-current py-0.5 text-[10px] font-medium opacity-60 hover:opacity-100 transition-opacity"
                >
                  Open →
                </Link>
              </div>
            );
          })}

          {filteredIssues.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
              No issues match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
