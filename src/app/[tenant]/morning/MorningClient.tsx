"use client";

import { useState } from "react";
import Link from "next/link";
import type { MorningBriefing, BriefingIssue, SprintHealth, WorkloadEntry, BlockerIssue, ProjectSprintSummary, MemberActivityEntry } from "@/lib/services/morningBriefing";

// ── Shared primitives ─────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  backlog:     { label: "Backlog",     cls: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  todo:        { label: "To Do",       cls: "bg-blue-50 text-blue-600 border-blue-200" },
  in_progress: { label: "In Progress", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  in_review:   { label: "In Review",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  done:        { label: "Done",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  blocked:     { label: "Blocked",     cls: "bg-red-50 text-red-700 border-red-200" },
};

const PRI_META: Record<string, { dot: string; label: string }> = {
  urgent: { dot: "bg-red-500",    label: "Urgent" },
  high:   { dot: "bg-orange-400", label: "High" },
  medium: { dot: "bg-yellow-400", label: "Medium" },
  low:    { dot: "bg-neutral-300", label: "Low" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-neutral-100 text-neutral-500 border-neutral-200" };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

function PriBadge({ priority }: { priority: string }) {
  const m = PRI_META[priority] ?? { dot: "bg-neutral-300", label: priority };
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-neutral-500">
      <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
      <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      {right}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-neutral-400">{text}</div>
  );
}

function ProgressBar({ pct, color = "bg-indigo-500" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ── Issue row (used in multiple views) ────────────────────────────────────

function IssueRow({ issue, slug, showProject = true }: { issue: BriefingIssue; slug: string; showProject?: boolean }) {
  return (
    <Link
      href={`/${slug}/issues/${issue.id}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors group"
    >
      <span className="font-mono text-[10px] text-neutral-400 w-16 shrink-0">
        {issue.projectKey}-{issue.number}
      </span>
      <span className="flex-1 text-sm text-neutral-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
        {issue.title}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {issue.isOverdue && (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
            Overdue
          </span>
        )}
        {showProject && (
          <span className="text-[10px] text-neutral-400 font-mono">{issue.projectKey}</span>
        )}
        <PriBadge priority={issue.priority} />
        <StatusBadge status={issue.status} />
      </div>
    </Link>
  );
}

// ── Sprint Health card ────────────────────────────────────────────────────

function SprintCard({ sprint, slug }: { sprint: SprintHealth; slug: string }) {
  const [expanded, setExpanded] = useState(false);
  const barColor = sprint.pctDone >= 70 ? "bg-emerald-500" : sprint.blocked > 0 ? "bg-red-400" : "bg-indigo-500";
  const daysLabel = sprint.daysLeft === null ? null
    : sprint.daysLeft < 0 ? "Overdue"
    : sprint.daysLeft === 0 ? "Closes today"
    : `${sprint.daysLeft}d left`;

  return (
    <Card>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-0.5">
              Active Sprint · {sprint.projectKey}
            </p>
            <h3 className="text-base font-bold text-neutral-900">{sprint.name}</h3>
            {sprint.goal && (
              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">Goal: {sprint.goal}</p>
            )}
          </div>
          {daysLabel && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              sprint.daysLeft !== null && sprint.daysLeft <= 2
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-neutral-100 text-neutral-600"
            }`}>
              {daysLabel}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-5">
          <div className="text-center">
            <p className="text-xl font-bold text-emerald-600">{sprint.pctDone}%</p>
            <p className="text-[10px] text-neutral-400">Done</p>
          </div>
          {sprint.blocked > 0 && (
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{sprint.blocked}</p>
              <p className="text-[10px] text-neutral-400">Blocked</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xl font-bold text-amber-500">{sprint.inReview}</p>
            <p className="text-[10px] text-neutral-400">In Review</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-indigo-600">{sprint.inProgressCount}</p>
            <p className="text-[10px] text-neutral-400">In Progress</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-semibold text-neutral-700">{sprint.done} / {sprint.total}</p>
            <p className="text-[10px] text-neutral-400">issues done</p>
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar pct={sprint.pctDone} color={barColor} />
        </div>
      </div>

      {/* Sprint issues toggle */}
      {sprint.issues.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full border-t border-neutral-100 px-5 py-2.5 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-50 transition-colors flex items-center justify-between"
          >
            <span>Sprint Issues ({sprint.issues.length})</span>
            <span className="text-neutral-300">{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div className="border-t border-neutral-100 divide-y divide-neutral-50">
              {sprint.issues.map((i) => (
                <IssueRow key={i.id} issue={i} slug={slug} showProject={false} />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ── AI Digest — top banner (compact, always first) ───────────────────────

function DigestBanner({ digest, fresh }: { digest: MorningBriefing["digest"]; fresh: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!digest) {
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3.5 flex items-center gap-3">
        <span className="text-base">✨</span>
        <p className="text-sm text-indigo-600 font-medium">AI Digest</p>
        <p className="text-xs text-indigo-400">No digest yet — generates at 6am daily.</p>
      </div>
    );
  }

  const genTime = new Date(digest.generated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const SECTION_META = {
    shipped:      { icon: "✅", label: "Shipped" },
    in_progress:  { icon: "🔄", label: "In Progress" },
    blocked:      { icon: "🚨", label: "Blocked" },
    needs_triage: { icon: "⚠️", label: "Needs Triage" },
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white overflow-hidden">
      {/* Summary row — always visible */}
      <div className="flex items-start gap-3 px-5 py-4">
        <span className="text-lg mt-0.5 shrink-0">✨</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-indigo-800">AI Digest</span>
            <span className="text-[10px] text-indigo-400">
              {fresh ? `Updated ${genTime}` : "Cached"}
            </span>
          </div>
          {digest.ai_summary && (
            <p className="text-sm text-indigo-900 leading-relaxed">{digest.ai_summary}</p>
          )}
        </div>
        {digest.entries.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            {expanded ? "Less ▲" : "Details ▼"}
          </button>
        )}
      </div>

      {/* Expandable detail rows */}
      {expanded && digest.entries.length > 0 && (
        <div className="border-t border-indigo-100 divide-y divide-indigo-50 bg-white">
          {digest.entries.map((entry) => {
            const meta = SECTION_META[entry.section as keyof typeof SECTION_META] ?? { icon: "•", label: entry.section };
            return (
              <div key={entry.section} className="px-5 py-3 flex gap-4">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400 w-24 shrink-0 pt-0.5">
                  {meta.icon} {meta.label}
                </span>
                <ul className="flex-1 space-y-0.5">
                  {entry.items.slice(0, 5).map((item, i) => (
                    <li key={i} className="text-xs text-neutral-600 line-clamp-1">· {item}</li>
                  ))}
                  {entry.items.length > 5 && (
                    <li className="text-[10px] text-neutral-400">+{entry.items.length - 5} more</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DEVELOPER VIEW ────────────────────────────────────────────────────────

function DeveloperView({ briefing, slug }: { briefing: MorningBriefing; slug: string }) {
  const sprint = briefing.primarySprint;
  const myInProgress = briefing.myIssues.filter((i) => i.status === "in_progress").length;
  const myInReview   = briefing.myIssues.filter((i) => i.status === "in_review").length;
  const myBlocked    = briefing.myIssues.filter((i) => i.status === "blocked").length;

  return (
    <div className="space-y-5">
      <DigestBanner digest={briefing.digest} fresh={briefing.digestFresh} />

      {/* Quick-stat strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Assigned to me", value: briefing.myIssues.length, color: "text-neutral-800", bg: "bg-white" },
          { label: "In Progress",    value: myInProgress,             color: "text-indigo-600",  bg: "bg-indigo-50" },
          { label: "In Review",      value: myInReview,               color: "text-amber-600",   bg: "bg-amber-50" },
          { label: "Blocked",        value: myBlocked,                color: myBlocked > 0 ? "text-red-600" : "text-neutral-400", bg: myBlocked > 0 ? "bg-red-50" : "bg-white" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-neutral-200 ${s.bg} px-5 py-4`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main 3-column grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* My Work — 2 cols */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="My Work"
              right={
                <Link href={`/${slug}/issues?assignee=me`} className="text-xs text-indigo-600 hover:underline">
                  View all →
                </Link>
              }
            />
            {briefing.myIssues.length === 0 ? (
              <EmptyState text="No open issues assigned to you 🎉" />
            ) : (
              <div className="divide-y divide-neutral-50">
                {briefing.myIssues.slice(0, 12).map((i) => (
                  <IssueRow key={i.id} issue={i} slug={slug} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          {sprint ? (
            <SprintCard sprint={sprint} slug={slug} />
          ) : (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-neutral-400">No active sprint</div>
            </Card>
          )}

          {briefing.unreadMentions > 0 && (
            <Card>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-lg">💬</span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      {briefing.unreadMentions} unread
                    </p>
                    <p className="text-xs text-neutral-400">Notifications</p>
                  </div>
                </div>
                <Link
                  href={`/${slug}/notifications`}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  View →
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PM VIEW ───────────────────────────────────────────────────────────────

function PMView({ briefing, slug }: { briefing: MorningBriefing; slug: string }) {
  const totalOpen    = briefing.projectSprints.reduce((s, p) => s + p.openCount, 0);
  const totalBlocked = briefing.projectSprints.reduce((s, p) => s + p.blockedCount, 0);
  const totalOverdue = briefing.projectSprints.reduce((s, p) => s + p.overdueCount, 0);

  return (
    <div className="space-y-5">
      <DigestBanner digest={briefing.digest} fresh={briefing.digestFresh} />

      {/* PM stat strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Projects",     value: briefing.projectSprints.length, color: "text-neutral-800", bg: "bg-white" },
          { label: "Open Issues",  value: totalOpen,                      color: "text-indigo-600",  bg: "bg-indigo-50" },
          { label: "Blocked",      value: totalBlocked,                   color: totalBlocked > 0 ? "text-red-600" : "text-neutral-400", bg: totalBlocked > 0 ? "bg-red-50" : "bg-white" },
          { label: "Overdue",      value: totalOverdue,                   color: totalOverdue > 0 ? "text-amber-600" : "text-neutral-400", bg: totalOverdue > 0 ? "bg-amber-50" : "bg-white" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-neutral-200 ${s.bg} px-5 py-4`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 3-column main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Project cards — 2 cols */}
        <div className="lg:col-span-2 space-y-5">
          {briefing.projectSprints.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-400">Project Status</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {briefing.projectSprints.map((ps) => (
                  <ProjectSprintCard key={ps.projectId} ps={ps} slug={slug} />
                ))}
              </div>
            </div>
          )}

          {/* Team Workload full-width below project cards */}
          <Card>
            <CardHeader title="Team Workload" right={<span className="text-xs text-neutral-400">open issues</span>} />
            {briefing.teamWorkload.length === 0 ? (
              <EmptyState text="No open issues" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-neutral-50">
                {briefing.teamWorkload.map((w) => (
                  <WorkloadRow key={w.userId ?? "unassigned"} entry={w} max={briefing.teamWorkload[0]?.openCount ?? 1} slug={slug} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right rail — blockers + overdue */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Blockers"
              right={
                briefing.blockers.length > 0 ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-200">
                    {briefing.blockers.length}
                  </span>
                ) : null
              }
            />
            {briefing.blockers.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="text-lg">✅</span>
                <p className="text-sm text-neutral-500">No blocked issues — all clear.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {briefing.blockers.map((b) => (
                  <BlockerRow key={b.id} blocker={b} slug={slug} />
                ))}
              </div>
            )}
          </Card>

          {briefing.overdueIssues.length > 0 && (
            <Card>
              <CardHeader
                title="Overdue Issues"
                right={
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-200">
                    {briefing.overdueIssues.length}
                  </span>
                }
              />
              <div className="divide-y divide-neutral-50">
                {briefing.overdueIssues.slice(0, 8).map((i) => (
                  <IssueRow key={i.id} issue={i} slug={slug} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectSprintCard({ ps, slug }: { ps: ProjectSprintSummary; slug: string }) {
  const health = ps.blockedCount > 0 ? "blocked" : ps.overdueCount > 0 ? "overdue" : "ok";
  const healthCls = health === "blocked" ? "text-red-600" : health === "overdue" ? "text-amber-600" : "text-emerald-600";
  const healthLabel = health === "blocked" ? `${ps.blockedCount} blocked` : health === "overdue" ? `${ps.overdueCount} overdue` : "On track";

  return (
    <Link href={`/${slug}/projects/${ps.projectKey}`}>
      <div className="rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-md hover:border-neutral-300 transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs font-bold text-neutral-500">{ps.projectKey}</span>
          <span className={`text-xs font-semibold ${healthCls}`}>{healthLabel}</span>
        </div>
        <p className="text-sm font-semibold text-neutral-800 mb-2 line-clamp-1">{ps.projectName}</p>
        {ps.sprint ? (
          <>
            <p className="text-[10px] text-neutral-400 mb-1">{ps.sprint.name}</p>
            <ProgressBar pct={ps.sprint.pctDone} color={health === "blocked" ? "bg-red-400" : "bg-indigo-500"} />
            <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
              <span>{ps.sprint.pctDone}% done</span>
              <span>{ps.sprint.daysLeft !== null ? `${ps.sprint.daysLeft}d left` : ""}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-neutral-400">No active sprint · {ps.openCount} open</p>
        )}
      </div>
    </Link>
  );
}

function WorkloadRow({ entry, max, slug }: { entry: WorkloadEntry; max: number; slug: string }) {
  const pct = max > 0 ? (entry.openCount / max) * 100 : 0;
  const href = `/${slug}/issues?assignee=${entry.userId ?? "none"}`;
  return (
    <Link href={href} className="block px-5 py-3 hover:bg-neutral-50 transition-colors group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-neutral-800 group-hover:text-indigo-600 transition-colors">{entry.name}</span>
        <div className="flex items-center gap-2">
          {entry.blockedCount > 0 && (
            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
              {entry.blockedCount} blocked
            </span>
          )}
          {entry.urgentCount > 0 && (
            <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
              {entry.urgentCount} urgent
            </span>
          )}
          <span className="text-xs font-bold text-neutral-600 w-6 text-right">{entry.openCount}</span>
        </div>
      </div>
      <ProgressBar pct={pct} color="bg-indigo-400" />
    </Link>
  );
}

function BlockerRow({ blocker, slug }: { blocker: BlockerIssue; slug: string }) {
  return (
    <Link
      href={`/${slug}/issues/${blocker.id}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors group"
    >
      <span className="font-mono text-[10px] text-neutral-400 w-20 shrink-0">
        {blocker.projectKey}-{blocker.number}
      </span>
      <span className="flex-1 text-sm text-neutral-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
        {blocker.title}
      </span>
      <div className="flex items-center gap-2 shrink-0 text-xs text-neutral-500">
        <span>{blocker.assigneeName}</span>
        <span className="font-semibold text-red-600">{blocker.daysBlocked}d</span>
      </div>
    </Link>
  );
}

// ── ADMIN VIEW ────────────────────────────────────────────────────────────

function AdminView({ briefing, slug }: { briefing: MorningBriefing; slug: string }) {
  const s = briefing.tenantStats;

  return (
    <div className="space-y-5">
      <DigestBanner digest={briefing.digest} fresh={briefing.digestFresh} />

      {/* KPI strip — 6 tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Open",        value: s.totalOpen,       color: "text-neutral-800",                                            bg: "bg-white" },
          { label: "Done",        value: s.totalDone,       color: "text-emerald-600",                                            bg: "bg-emerald-50" },
          { label: "In Progress", value: s.inProgressCount, color: "text-indigo-600",                                             bg: "bg-indigo-50" },
          { label: "Blocked",     value: s.blocked,         color: s.blocked > 0     ? "text-red-600"   : "text-neutral-400",    bg: s.blocked > 0     ? "bg-red-50"    : "bg-white" },
          { label: "Unassigned",  value: s.unassigned,      color: s.unassigned > 0  ? "text-amber-600" : "text-neutral-400",    bg: s.unassigned > 0  ? "bg-amber-50"  : "bg-white" },
          { label: "Overdue",     value: s.overdueOpen,     color: s.overdueOpen > 0 ? "text-red-600"   : "text-neutral-400",    bg: s.overdueOpen > 0 ? "bg-red-50"    : "bg-white" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border border-neutral-200 ${kpi.bg} px-5 py-4`}>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Member Activity */}
        <Card>
          <CardHeader title="Member Activity" right={<span className="text-xs text-neutral-400">last 7 days</span>} />
          {briefing.memberActivity.length === 0 ? (
            <EmptyState text="No members" />
          ) : (
            <div className="divide-y divide-neutral-50">
              {briefing.memberActivity.map((m) => (
                <MemberRow key={m.userId} member={m} />
              ))}
            </div>
          )}
        </Card>

        {/* Blockers */}
        <Card>
          <CardHeader
            title="Blockers"
            right={
              briefing.blockers.length > 0 ? (
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-200">
                  {briefing.blockers.length}
                </span>
              ) : null
            }
          />
          {briefing.blockers.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6">
              <span className="text-lg">✅</span>
              <p className="text-sm text-neutral-500">No blocked issues.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {briefing.blockers.slice(0, 8).map((b) => (
                <BlockerRow key={b.id} blocker={b} slug={slug} />
              ))}
            </div>
          )}
        </Card>

        {/* Team Workload */}
        <Card>
          <CardHeader title="Team Workload" right={<Link href={`/${slug}/reports`} className="text-xs text-indigo-600 hover:underline">Full report →</Link>} />
          {briefing.teamWorkload.length === 0 ? (
            <EmptyState text="No open issues" />
          ) : (
            <div className="divide-y divide-neutral-50">
              {briefing.teamWorkload.map((w) => (
                <WorkloadRow key={w.userId ?? "unassigned"} entry={w} max={briefing.teamWorkload[0]?.openCount ?? 1} slug={slug} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: MemberActivityEntry }) {
  const isQuiet = member.issuesUpdatedLast7d === 0;
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
        {member.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800 truncate">{member.name}</p>
        <p className={`text-xs ${isQuiet ? "text-amber-500" : "text-neutral-400"}`}>{member.lastActiveLabel}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-neutral-700">{member.issuesOwned}</p>
        <p className="text-[10px] text-neutral-400">owned</p>
      </div>
    </div>
  );
}

// ── Greeting ──────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dateLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Role tabs ─────────────────────────────────────────────────────────────

type RoleTab = "developer" | "pm" | "admin";

const ROLE_TABS: { id: RoleTab; label: string; icon: string }[] = [
  { id: "developer", label: "Developer",  icon: "💻" },
  { id: "pm",        label: "PM",         icon: "📊" },
  { id: "admin",     label: "Admin",      icon: "⚙️" },
];

function defaultTab(role: string): RoleTab {
  if (role === "owner" || role === "admin") return "admin";
  if (role === "viewer") return "pm";
  return "developer";
}

// ── Root component ────────────────────────────────────────────────────────

export default function MorningClient({
  slug,
  role,
  firstName,
  briefing,
}: {
  slug: string;
  role: string;
  firstName: string;
  briefing: MorningBriefing;
}) {
  const [activeTab, setActiveTab] = useState<RoleTab>(defaultTab(role));

  return (
    <div className="w-full px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm text-neutral-400">{dateLabel()} · Here&apos;s your day</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/${slug}/board`}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Board →
          </Link>
          <Link
            href={`/${slug}/issues`}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            All Issues →
          </Link>
        </div>
      </div>

      {/* Role tabs */}
      <div className="mb-6 flex gap-1 border-b border-neutral-200">
        {ROLE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === t.id
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Views */}
      {activeTab === "developer" && <DeveloperView briefing={briefing} slug={slug} />}
      {activeTab === "pm"        && <PMView        briefing={briefing} slug={slug} />}
      {activeTab === "admin"     && <AdminView     briefing={briefing} slug={slug} />}
    </div>
  );
}
