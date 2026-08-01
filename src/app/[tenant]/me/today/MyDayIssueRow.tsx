"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateIssueAction } from "../../issues/[id]/actions";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#c0392b",
  high: "#c9791d",
  medium: "#3a6ea8",
  low: "#a19d90",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In Progress",
  todo: "To Do",
  in_review: "In Review",
  backlog: "Backlog",
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type FocusIssue = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectKey: string;
  sprintName: string | null;
  isOverdue: boolean;
};

export default function MyDayIssueRow({ issue, slug, first }: { issue: FocusIssue; slug: string; first: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function markDone() {
    setDone(true);
    startTransition(async () => {
      try {
        await updateIssueAction(slug, issue.id, { status: "done" });
        router.refresh();
      } catch {
        setDone(false);
      }
    });
  }

  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-[11px] transition-colors ${
        first ? "" : "border-t border-[#e3ded0]"
      } ${done ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark ${issue.projectKey}-${issue.number} done`}
        onClick={markDone}
        disabled={pending || done}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-[#c3bda9] transition-colors hover:border-[#8c4632] disabled:cursor-default"
        style={done ? { backgroundColor: "#3f7d4c", borderColor: "#3f7d4c" } : undefined}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5l2.5 2.5 4.5-5.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <Link
        href={`/${slug}/issues/${issue.id}`}
        className={`flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 ${done ? "pointer-events-none" : ""}`}
      >
        <span className="shrink-0 font-mono text-[11px] font-bold text-[#726e60]">
          {issue.projectKey}-{issue.number}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[13px] text-[#20201d] ${done ? "line-through" : ""}`}>{issue.title}</span>
        {issue.sprintName && (
          <span className="shrink-0 text-[11px] text-[#a19d90]">{issue.sprintName}</span>
        )}
        {issue.dueDate && (
          <span
            className={`shrink-0 text-right text-[11px] ${
              issue.isOverdue ? "font-bold text-[#c0392b]" : "text-[#a19d90]"
            }`}
          >
            Due {fmtDate(issue.dueDate)}
          </span>
        )}
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ color: PRIORITY_COLOR[issue.priority] ?? "#a19d90" }}
        >
          {STATUS_LABEL[issue.status] ?? issue.status}
        </span>
      </Link>
    </div>
  );
}
