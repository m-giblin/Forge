"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SectionGroup from "@/components/patterns/SectionGroup";
import ListRow from "@/components/patterns/ListRow";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";
import { avatarColor, initials } from "@/lib/ui/avatar";

const STATUS_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  backlog: { fg: "#a19d90", bg: "#f1efe9", label: "Backlog" },
  todo: { fg: "#3a6ea8", bg: "#eaf1f8", label: "To Do" },
  in_progress: { fg: "#c9791d", bg: "#fdf1de", label: "In Progress" },
  in_review: { fg: "#7a4fa0", bg: "#f4ecfa", label: "In Review" },
  blocked: { fg: "#c0392b", bg: "#fbeae8", label: "Blocked" },
  done: { fg: "#3f7d4c", bg: "#e9f3ea", label: "Done" },
};

const PRIORITY_STYLE: Record<string, { color: string; label: string }> = {
  low: { color: "#a19d90", label: "Low" },
  medium: { color: "#3a6ea8", label: "Medium" },
  high: { color: "#c9791d", label: "High" },
  urgent: { color: "#c0392b", label: "Urgent" },
};

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];

function statusStyle(s: string) {
  return STATUS_STYLE[s] ?? { fg: "#a19d90", bg: "#f1efe9", label: s.replace(/_/g, " ") };
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export type AssignedIssue = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string | null;
  type: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  project: { key: string; name: string } | null;
};

type BucketKey = "all" | "overdue" | "blocked" | "inprogress" | "upcoming";

export default function AssignedWorkList({
  slug,
  issues,
  assigneeLabel,
  assigneeId,
}: {
  slug: string;
  issues: AssignedIssue[];
  assigneeLabel: string;
  assigneeId: string;
}) {
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<BucketKey>("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [sort, setSort] = useState<"priority" | "updated" | "due">("priority");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Bucket by urgency (an issue can land in Overdue AND Blocked at once — each
  // filter is independent; Upcoming is only what's left over from the rest).
  const overdueIssues = useMemo(() => issues.filter((i) => i.due_date && new Date(i.due_date) < today), [issues, today]);
  const blockedIssues = useMemo(() => issues.filter((i) => i.status === "blocked"), [issues]);
  const inProgressIssues = useMemo(
    () => issues.filter((i) => i.status === "in_progress" || i.status === "in_review"),
    [issues]
  );
  const upcomingIssues = useMemo(
    () => issues.filter((i) => !overdueIssues.includes(i) && !blockedIssues.includes(i) && !inProgressIssues.includes(i)),
    [issues, overdueIssues, blockedIssues, inProgressIssues]
  );

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues) {
      if (i.project) map.set(i.project.key, i.project.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [issues]);

  const pills: { key: BucketKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: issues.length },
    { key: "overdue", label: "Overdue", count: overdueIssues.length },
    { key: "blocked", label: "Blocked", count: blockedIssues.length },
    { key: "inprogress", label: "In progress", count: inProgressIssues.length },
    { key: "upcoming", label: "Upcoming", count: upcomingIssues.length },
  ];

  const priorityRank = (i: AssignedIssue) => {
    const idx = i.priority ? PRIORITY_ORDER.indexOf(i.priority) : -1;
    return idx === -1 ? PRIORITY_ORDER.length : idx;
  };

  const filtered = useMemo(() => {
    let base = issues;
    if (bucketFilter === "overdue") base = overdueIssues;
    else if (bucketFilter === "blocked") base = blockedIssues;
    else if (bucketFilter === "inprogress") base = inProgressIssues;
    else if (bucketFilter === "upcoming") base = upcomingIssues;

    if (projectFilter) base = base.filter((i) => i.project?.key === projectFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          `${i.project?.key ?? ""}-${i.number}`.toLowerCase().includes(q)
      );
    }

    const sorted = [...base];
    if (sort === "priority") sorted.sort((a, b) => priorityRank(a) - priorityRank(b));
    else if (sort === "updated") sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    else if (sort === "due")
      sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    return sorted;
  }, [issues, bucketFilter, projectFilter, search, sort, overdueIssues, blockedIssues, inProgressIssues, upcomingIssues]);

  const buckets: { key: string; label: string; color: string; issues: AssignedIssue[] }[] =
    bucketFilter === "all"
      ? [
          { key: "overdue", label: "Overdue", color: "#c0392b", issues: filtered.filter((i) => overdueIssues.includes(i)) },
          { key: "blocked", label: "Blocked", color: "#c0392b", issues: filtered.filter((i) => blockedIssues.includes(i)) },
          { key: "inprogress", label: "In progress / review", color: "#c9791d", issues: filtered.filter((i) => inProgressIssues.includes(i)) },
          { key: "upcoming", label: "Upcoming", color: "#3a6ea8", issues: filtered.filter((i) => upcomingIssues.includes(i)) },
        ]
      : [{ key: bucketFilter, label: pills.find((p) => p.key === bucketFilter)!.label, color: "#8c4632", issues: filtered }];

  const avatarBg = avatarColor(assigneeId);
  const avatarInitials = initials(assigneeLabel);

  return (
    <>
      <div className="border-b border-[var(--fw-cream-border)] bg-[var(--fw-cream-bg)] px-6 pb-3">
        <FilterRow>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search my work…"
            style={{ width: 190 }}
            className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-3 py-[6px] text-[11.5px] text-[#20201d] outline-none placeholder:text-[#a19d90] focus:border-[#8c4632]"
          />

          {pills.map((p) => (
            <FilterPill key={p.key} active={bucketFilter === p.key} onClick={() => setBucketFilter(p.key)}>
              {p.label} {p.count}
            </FilterPill>
          ))}

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none"
          >
            <option value="">All projects</option>
            {projectOptions.map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "priority" | "updated" | "due")}
            className="shrink-0 rounded-full border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-[11px] py-[6px] text-[11.5px] font-semibold text-[#4a473e] outline-none"
          >
            <option value="priority">Sort: Priority</option>
            <option value="updated">Sort: Updated</option>
            <option value="due">Sort: Due date</option>
          </select>
        </FilterRow>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px] pb-7">
        {filtered.length === 0 ? (
          <div className="fw-card px-6 py-16 text-center">
            <p className="text-[13px] text-[#726e60]">
              {issues.length === 0 ? "Nothing assigned to you right now. 🎉" : "No issues match these filters."}
            </p>
          </div>
        ) : (
          <div className="flex max-w-[1080px] flex-col gap-5">
            {buckets.map((bucket) => {
              if (bucket.issues.length === 0) return null;
              return (
                <SectionGroup key={bucket.key} label={bucket.label} color={bucket.color} count={bucket.issues.length}>
                  {bucket.issues.map((issue, idx) => {
                    const dueDate = issue.due_date ? new Date(issue.due_date) : null;
                    const isOverdue = dueDate && dueDate < today;
                    const status = statusStyle(issue.status);
                    const priority = issue.priority ? PRIORITY_STYLE[issue.priority] : null;
                    return (
                      <Link key={issue.id} href={`/${slug}/issues/${issue.id}`} className="block">
                        <ListRow
                          first={idx === 0}
                          title={
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="shrink-0 rounded-[4px] bg-[#eae6da] px-[7px] py-[2px] font-mono text-[11px] font-bold text-[#726e60]">
                                {issue.project?.key ?? "?"}-{issue.number}
                              </span>
                              <span className="min-w-0 truncate">{issue.title}</span>
                            </span>
                          }
                          right={
                            <>
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                style={{ color: status.fg, backgroundColor: status.bg }}
                              >
                                {status.label}
                              </span>
                              {priority && (
                                <span className="shrink-0 text-[11px] font-semibold" style={{ color: priority.color }}>
                                  {priority.label}
                                </span>
                              )}
                              {issue.project && (
                                <span className="shrink-0 text-[11px] text-[#a19d90]">{issue.project.name}</span>
                              )}
                              {dueDate && (
                                <span
                                  className={`shrink-0 text-[11px] ${isOverdue ? "font-semibold text-[#c0392b]" : "text-[#a19d90]"}`}
                                >
                                  Due {dueDate.toLocaleDateString()}
                                  {isOverdue && " (overdue)"}
                                </span>
                              )}
                              <span className="shrink-0 text-[11px] text-[#c3bda9]">{relativeTime(issue.updated_at)}</span>
                              <span
                                title={assigneeLabel}
                                style={{ backgroundColor: avatarBg }}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                              >
                                {avatarInitials}
                              </span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c3bda9" strokeWidth="2.4" className="shrink-0">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </>
                          }
                        />
                      </Link>
                    );
                  })}
                </SectionGroup>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
