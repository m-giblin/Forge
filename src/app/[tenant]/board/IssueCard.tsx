"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import type { Issue } from "@/lib/repositories/issues";
import type { FieldOption } from "@/lib/repositories/fieldConfig";
import { avatarColor, initials } from "@/lib/ui/avatar";
import { quickEditIssueAction } from "./actions";

type QuickEditProps = {
  issue: Issue;
  slug: string;
  prMap: Map<string, FieldOption>;
  memMap: Map<string, string>;
  onClose: () => void;
};

function QuickEditPopover({ issue, slug, prMap, memMap, onClose }: QuickEditProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(issue.title);
  const priorities = [...prMap.values()];
  const members = [...memMap.entries()];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function applyPriority(priority: string) {
    startTransition(async () => {
      await quickEditIssueAction(slug, issue.id, { priority: priority as Issue["priority"] });
      onClose();
    });
  }

  function applyAssignee(assigneeId: string | null) {
    startTransition(async () => {
      await quickEditIssueAction(slug, issue.id, { assigneeId });
      onClose();
    });
  }

  function applyTitle() {
    if (title.trim() === issue.title) { onClose(); return; }
    startTransition(async () => {
      await quickEditIssueAction(slug, issue.id, { title: title.trim() });
      onClose();
    });
  }

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-7 z-50 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white shadow-lg p-3 space-y-3"
    >
      {isPending && (
        <p className="text-[10px] text-neutral-400 text-center">Saving…</p>
      )}

      {/* Title */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Title</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={applyTitle}
          onKeyDown={(e) => { if (e.key === "Enter") applyTitle(); if (e.key === "Escape") onClose(); }}
          className="w-full rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>

      {/* Priority */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Priority</p>
        <div className="flex flex-wrap gap-1">
          {priorities.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPriority(p.key)}
              disabled={isPending}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition ${
                issue.priority === p.key
                  ? "border-transparent text-white"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
              }`}
              style={issue.priority === p.key ? { backgroundColor: p.color ?? "#6366f1" } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Assignee</p>
        <div className="space-y-1 max-h-28 overflow-y-auto">
          <button
            onClick={() => applyAssignee(null)}
            disabled={isPending}
            className={`w-full text-left px-2 py-1 rounded text-xs transition ${
              !issue.assignee_id ? "bg-neutral-100 text-neutral-800" : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            Unassigned
          </button>
          {members.map(([userId, name]) => (
            <button
              key={userId}
              onClick={() => applyAssignee(userId)}
              disabled={isPending}
              className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-xs transition ${
                issue.assignee_id === userId ? "bg-neutral-100 text-neutral-800" : "text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                style={{ backgroundColor: avatarColor(userId) }}
              >
                {initials(name)}
              </span>
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function IssueCard({
  issue,
  slug,
  canEdit,
  tyMap,
  prMap,
  memMap,
  catMap,
  onDragStart,
  onClickIssue,
  projectKey,
  showAssignee,
}: {
  issue: Issue;
  slug: string;
  canEdit: boolean;
  tyMap: Map<string, FieldOption>;
  prMap: Map<string, FieldOption>;
  memMap: Map<string, string>;
  catMap: Map<string, string>;
  onDragStart: () => void;
  onClickIssue: () => void;
  projectKey: string;
  showAssignee: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const ty = tyMap.get(issue.type);
  const pr = prMap.get(issue.priority);

  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      onClick={() => { if (!editing) onClickIssue(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!editing) setHovered(false); }}
      className={`relative cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 shadow-sm hover:border-neutral-300 ${canEdit ? "active:cursor-grabbing" : ""}`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pr?.color ?? "#9CA3AF" }} />
        <span className="text-xs font-medium" style={{ color: pr?.color ?? "#9CA3AF" }}>
          {pr?.label ?? issue.priority}
        </span>
        <span className="ml-auto text-xs font-medium text-neutral-400">{projectKey}-{issue.number}</span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium" style={{ color: ty?.color ?? "#525252" }}>
          {ty?.label ?? issue.type}
        </span>
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); }}
            className={`ml-1 flex h-7 w-7 items-center justify-center rounded text-base text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition md:h-auto md:w-auto md:px-1 md:py-0.5 md:text-xs ${hovered || editing ? "opacity-100" : "opacity-0 md:opacity-0 sm:opacity-100"}`}
            title="Quick edit"
          >
            ⋯
          </button>
        )}
      </div>

      <p className="text-sm text-neutral-800">{issue.title}</p>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {issue.phase && (
          <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-600">
            {issue.phase.charAt(0).toUpperCase() + issue.phase.slice(1)}
          </span>
        )}
        {issue.category_id && catMap.get(issue.category_id) && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
            {catMap.get(issue.category_id)}
          </span>
        )}
      </div>

      {showAssignee && issue.assignee_id && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColor(issue.assignee_id) }}
            title={memMap.get(issue.assignee_id) ?? "Assigned"}
          >
            {initials(memMap.get(issue.assignee_id) ?? "?")}
          </span>
          <span className="truncate text-xs text-neutral-400">
            {memMap.get(issue.assignee_id) ?? "Assigned"}
          </span>
        </div>
      )}

      {editing && canEdit && (
        <QuickEditPopover
          issue={issue}
          slug={slug}
          prMap={prMap}
          memMap={memMap}
          onClose={() => { setEditing(false); setHovered(false); }}
        />
      )}
    </div>
  );
}
