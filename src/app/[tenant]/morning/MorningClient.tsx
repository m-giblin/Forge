"use client";

import { useState } from "react";
import Link from "next/link";
import type { MorningBriefing, BriefingIssue, SprintHealth, WorkloadEntry, BlockerIssue, ProjectSprintSummary, MemberActivityEntry } from "@/lib/services/morningBriefing";
import type { RiskGateWithIssue } from "@/lib/repositories/issueRiskGates";

// ── Shared primitives ─────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  backlog:     { label: "Backlog",     cls: "text-[#a19d90] border-[#ddd8c9]" },
  todo:        { label: "To Do",       cls: "text-[#3a6ea8] border-[#3a6ea8]/30" },
  in_progress: { label: "In Progress", cls: "text-[#c9791d] border-[#c9791d]/30" },
  in_review:   { label: "In Review",   cls: "text-[#7a4fa0] border-[#7a4fa0]/30" },
  done:        { label: "Done",        cls: "text-[#3f7d4c] border-[#3f7d4c]/30" },
  blocked:     { label: "Blocked",     cls: "text-[#c0392b] border-[#c0392b]/30" },
};

const STATUS_BG: Record<string, string> = {
  backlog: "#f1efe9",
  todo: "#eaf1f8",
  in_progress: "#fdf1de",
  in_review: "#f4ecfa",
  done: "#e9f3ea",
  blocked: "#fbeae8",
};

const PRI_META: Record<string, { dot: string; label: string }> = {
  urgent: { dot: "#c0392b", label: "Urgent" },
  high:   { dot: "#c9791d", label: "High" },
  medium: { dot: "#d9b23c", label: "Medium" },
  low:    { dot: "#a19d90", label: "Low" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "text-[#a19d90] border-[#ddd8c9]" };
  const bg = STATUS_BG[status] ?? "#f1efe9";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${m.cls}`} style={{ backgroundColor: bg }}>
      {m.label}
    </span>
  );
}

function PriBadge({ priority }: { priority: string }) {
  const m = PRI_META[priority] ?? { dot: "#a19d90", label: priority };
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-[#726e60]">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: m.dot }} />
      {m.label}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`fw-card ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[#ddd8c9] px-5 py-3.5">
      <h3 className="text-sm font-semibold text-[#20201d]">{title}</h3>
      {right}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-[#a19d90]">{text}</div>
  );
}

function ProgressBar({ pct, color = "#b7452f" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#f1efe9]">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
    </div>
  );
}

// ── Risk Gates Widget ────────────────────────────────────────────────────

type MediumIssue = { id: string; number: number; title: string; projects: { key: string } };

function RiskGatesWidget({ gates, staleGateIds, mediumIssues, slug }: { gates: RiskGateWithIssue[]; staleGateIds: Set<string>; mediumIssues: MediumIssue[]; slug: string }) {
  const ageLabel = (iso: string) => {
    const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d ${h % 24}h`;
  };

  const totalCount = gates.length + mediumIssues.length;

  return (
    <Card>
      <CardHeader
        title="⚠ PR Risk Overview"
        right={
          totalCount > 0 ? (
            <div className="flex items-center gap-1.5">
              {gates.length > 0 && (
                <span className="rounded-full bg-[#fbeae8] px-2.5 py-0.5 text-xs font-semibold text-[#c0392b] border border-[#c0392b]/30">
                  {gates.length} gated
                </span>
              )}
              {mediumIssues.length > 0 && (
                <span className="rounded-full bg-[#fdf1de] px-2.5 py-0.5 text-xs font-semibold text-[#c9791d] border border-[#c9791d]/30">
                  {mediumIssues.length} medium
                </span>
              )}
            </div>
          ) : null
        }
      />

      {/* Gated — High / Critical */}
      {gates.length > 0 && (
        <div>
          <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#c0392b]">🚨 Risk Gates — Needs Your Approval</p>
          <div className="divide-y divide-[#ddd8c9]">
            {gates.map((g) => {
              const isStale = staleGateIds.has(g.id);
              const isCritical = g.riskLevel === "critical";
              return (
                <Link key={g.id} href={`/${slug}/issues/${g.issueId}`}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-[#fbeae8] transition-colors">
                  <span className="text-base mt-0.5">{isCritical ? "🔴" : "🟠"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-xs font-mono text-[#a19d90]">{g.issueKey}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${isCritical ? "bg-[#fbeae8] border-[#c0392b]/30 text-[#c0392b]" : "bg-[#fdf1de] border-[#c9791d]/30 text-[#c9791d]"}`}>
                        {g.riskLevel}
                      </span>
                      {isStale && <span className="rounded border border-[#c9791d]/30 bg-[#fdf1de] px-1.5 py-0.5 text-[10px] font-bold text-[#c9791d]">⏰ &gt;24h</span>}
                    </div>
                    <p className="text-sm text-[#20201d] truncate">{g.issueTitle}</p>
                    <p className="text-xs text-[#a19d90] mt-0.5">Blocked from closing · waiting {ageLabel(g.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Medium warnings */}
      {mediumIssues.length > 0 && (
        <div className={gates.length > 0 ? "border-t border-[#ddd8c9]" : ""}>
          <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#c9791d]">🟡 Medium Risk — Monitor</p>
          <div className="divide-y divide-[#ddd8c9]">
            {mediumIssues.map((i) => (
              <Link key={i.id} href={`/${slug}/issues/${i.id}`}
                className="flex items-start gap-3 px-5 py-3 hover:bg-[#fdf1de] transition-colors">
                <span className="text-base mt-0.5">🟡</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-[#a19d90] mb-0.5">{i.projects.key}-{i.number}</p>
                  <p className="text-sm text-[#20201d] truncate">{i.title}</p>
                  <p className="text-xs text-[#a19d90] mt-0.5">Not blocking — review before merge</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {totalCount === 0 && (
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="text-lg">✅</span>
          <p className="text-sm text-[#4a473e]">No PR risk flags — all clear.</p>
        </div>
      )}
    </Card>
  );
}

// ── Issue row (used in multiple views) ────────────────────────────────────

function IssueRow({ issue, slug, showProject = true }: { issue: BriefingIssue; slug: string; showProject?: boolean }) {
  return (
    <Link
      href={`/${slug}/issues/${issue.id}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-[#f4f2eb] transition-colors group"
    >
      <span className="font-mono text-[10px] text-[#a19d90] w-16 shrink-0">
        {issue.projectKey}-{issue.number}
      </span>
      <span className="flex-1 text-sm text-[#20201d] line-clamp-1 group-hover:text-[#b7452f] transition-colors">
        {issue.title}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {issue.isOverdue && (
          <span className="text-[10px] font-semibold text-[#c0392b] bg-[#fbeae8] border border-[#c0392b]/30 rounded px-1.5 py-0.5">
            Overdue
          </span>
        )}
        {showProject && (
          <span className="text-[10px] text-[#a19d90] font-mono">{issue.projectKey}</span>
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
  const barColor = sprint.pctDone >= 70 ? "#3f7d4c" : sprint.blocked > 0 ? "#c0392b" : "#b7452f";
  const daysLabel = sprint.daysLeft === null ? null
    : sprint.daysLeft < 0 ? "Overdue"
    : sprint.daysLeft === 0 ? "Closes today"
    : `${sprint.daysLeft}d left`;

  return (
    <Card>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#b7452f] mb-0.5">
              Active Sprint · {sprint.projectKey}
            </p>
            <h3 className="text-base font-bold text-[#20201d]">{sprint.name}</h3>
            {sprint.goal && (
              <p className="text-xs text-[#726e60] mt-0.5 line-clamp-1">Goal: {sprint.goal}</p>
            )}
          </div>
          {daysLabel && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              sprint.daysLeft !== null && sprint.daysLeft <= 2
                ? "bg-[#fbeae8] text-[#c0392b] border border-[#c0392b]/30"
                : "bg-[#f1efe9] text-[#4a473e]"
            }`}>
              {daysLabel}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-5">
          <div className="text-center">
            <p className="text-xl font-bold text-[#3f7d4c]">{sprint.pctDone}%</p>
            <p className="text-[10px] text-[#a19d90]">Done</p>
          </div>
          {sprint.blocked > 0 && (
            <div className="text-center">
              <p className="text-xl font-bold text-[#c0392b]">{sprint.blocked}</p>
              <p className="text-[10px] text-[#a19d90]">Blocked</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xl font-bold text-[#c9791d]">{sprint.inReview}</p>
            <p className="text-[10px] text-[#a19d90]">In Review</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#b7452f]">{sprint.inProgressCount}</p>
            <p className="text-[10px] text-[#a19d90]">In Progress</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-semibold text-[#4a473e]">{sprint.done} / {sprint.total}</p>
            <p className="text-[10px] text-[#a19d90]">issues done</p>
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
            className="w-full border-t border-[#ddd8c9] px-5 py-2.5 text-left text-xs font-medium text-[#726e60] hover:bg-[#f4f2eb] transition-colors flex items-center justify-between"
          >
            <span>Sprint Issues ({sprint.issues.length})</span>
            <span className="text-[#a19d90]">{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div className="border-t border-[#ddd8c9] divide-y divide-[#ddd8c9]">
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
      <div className="rounded-[6px] border border-[#454636] px-5 py-3.5 flex items-center gap-3" style={{ backgroundImage: "linear-gradient(160deg,#2a2c26,#20221d)" }}>
        <span
          className="inline-block rounded-full border px-[7px] py-[1px] text-[10px] font-extrabold"
          style={{ color: "#e29a7e", backgroundColor: "rgba(183,69,47,0.18)", borderColor: "rgba(183,69,47,0.35)" }}
        >
          AI
        </span>
        <p className="text-sm text-[#e5e0d1] font-medium">AI Digest</p>
        <p className="text-xs text-[#a19d90]">No digest yet — generates at 6am daily.</p>
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
    <div className="rounded-[6px] border border-[#454636] overflow-hidden" style={{ backgroundImage: "linear-gradient(160deg,#2a2c26,#20221d)" }}>
      {/* Summary row — always visible */}
      <div className="flex items-start gap-3 px-5 py-4">
        <span
          className="inline-block shrink-0 rounded-full border px-[7px] py-[1px] text-[10px] font-extrabold mt-0.5"
          style={{ color: "#e29a7e", backgroundColor: "rgba(183,69,47,0.18)", borderColor: "rgba(183,69,47,0.35)" }}
        >
          AI
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-[#e5e0d1]">AI Digest</span>
            <span className="text-[10px] text-[#a19d90]">
              {fresh ? `Updated ${genTime}` : "Cached"}
            </span>
          </div>
          {digest.ai_summary && (
            <p className="text-sm text-[#e5e0d1] leading-relaxed">{digest.ai_summary}</p>
          )}
        </div>
        {digest.entries.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-lg border border-[#454636] bg-[#20221d] px-3 py-1.5 text-xs font-medium text-[#e29a7e] hover:bg-[#2a2c26] transition-colors"
          >
            {expanded ? "Less ▲" : "Details ▼"}
          </button>
        )}
      </div>

      {/* Expandable detail rows */}
      {expanded && digest.entries.length > 0 && (
        <div className="border-t border-[#454636] divide-y divide-[#454636]">
          {digest.entries.map((entry) => {
            const meta = SECTION_META[entry.section as keyof typeof SECTION_META] ?? { icon: "•", label: entry.section };
            return (
              <div key={entry.section} className="px-5 py-3 flex gap-4">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#a19d90] w-24 shrink-0 pt-0.5">
                  {meta.icon} {meta.label}
                </span>
                <ul className="flex-1 space-y-0.5">
                  {entry.items.slice(0, 5).map((item, i) => (
                    <li key={i} className="text-xs text-[#e5e0d1] line-clamp-1">· {item}</li>
                  ))}
                  {entry.items.length > 5 && (
                    <li className="text-[10px] text-[#a19d90]">+{entry.items.length - 5} more</li>
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

function DeveloperView({ briefing, slug, openGates, staleGateIds, mediumRiskIssues }: { briefing: MorningBriefing; slug: string; openGates: RiskGateWithIssue[]; staleGateIds: Set<string>; mediumRiskIssues: MediumIssue[] }) {
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
          { label: "Assigned to me", value: briefing.myIssues.length, color: "text-[#20201d]", bg: "bg-white" },
          { label: "In Progress",    value: myInProgress,             color: "text-[#c9791d]",  bg: "bg-[#fdf1de]" },
          { label: "In Review",      value: myInReview,               color: "text-[#7a4fa0]",   bg: "bg-[#f4ecfa]" },
          { label: "Blocked",        value: myBlocked,                color: myBlocked > 0 ? "text-[#c0392b]" : "text-[#a19d90]", bg: myBlocked > 0 ? "bg-[#fbeae8]" : "bg-white" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-[#ddd8c9] ${s.bg} px-5 py-4`}>
            <p className={`font-[family-name:var(--font-manrope)] text-3xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[#726e60] mt-1 uppercase tracking-wide">{s.label}</p>
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
                <Link href={`/${slug}/issues?assignee=me`} className="text-xs text-[#b7452f] hover:underline">
                  View all →
                </Link>
              }
            />
            {briefing.myIssues.length === 0 ? (
              <EmptyState text="No open issues assigned to you 🎉" />
            ) : (
              <div className="divide-y divide-[#ddd8c9]">
                {briefing.myIssues.slice(0, 12).map((i) => (
                  <IssueRow key={i.id} issue={i} slug={slug} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          {(openGates.length > 0 || mediumRiskIssues.length > 0) && (
            <RiskGatesWidget gates={openGates} staleGateIds={staleGateIds} mediumIssues={mediumRiskIssues} slug={slug} />
          )}

          {sprint ? (
            <SprintCard sprint={sprint} slug={slug} />
          ) : (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-[#a19d90]">No active sprint</div>
            </Card>
          )}

          {briefing.unreadMentions > 0 && (
            <Card>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fdf1de] text-lg">💬</span>
                  <div>
                    <p className="text-sm font-semibold text-[#20201d]">
                      {briefing.unreadMentions} unread
                    </p>
                    <p className="text-xs text-[#a19d90]">Notifications</p>
                  </div>
                </div>
                <Link
                  href={`/${slug}/notifications`}
                  className="rounded-lg border border-[#ddd8c9] px-3 py-1.5 text-xs font-medium text-[#4a473e] hover:bg-[#f4f2eb] transition-colors"
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

function PMView({ briefing, slug, openGates, staleGateIds, mediumRiskIssues }: { briefing: MorningBriefing; slug: string; openGates: RiskGateWithIssue[]; staleGateIds: Set<string>; mediumRiskIssues: MediumIssue[] }) {
  const totalOpen    = briefing.projectSprints.reduce((s, p) => s + p.openCount, 0);
  const totalBlocked = briefing.projectSprints.reduce((s, p) => s + p.blockedCount, 0);
  const totalOverdue = briefing.projectSprints.reduce((s, p) => s + p.overdueCount, 0);

  return (
    <div className="space-y-5">
      <DigestBanner digest={briefing.digest} fresh={briefing.digestFresh} />

      {/* PM stat strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Projects",     value: briefing.projectSprints.length, color: "text-[#20201d]", bg: "bg-white" },
          { label: "Open Issues",  value: totalOpen,                      color: "text-[#b7452f]",  bg: "bg-[#f4f2eb]" },
          { label: "Blocked",      value: totalBlocked,                   color: totalBlocked > 0 ? "text-[#c0392b]" : "text-[#a19d90]", bg: totalBlocked > 0 ? "bg-[#fbeae8]" : "bg-white" },
          { label: "Risk Gates",   value: openGates.length,               color: openGates.length > 0 ? "text-[#c0392b]" : "text-[#a19d90]",    bg: openGates.length > 0 ? "bg-[#fbeae8]" : "bg-white" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-[#ddd8c9] ${s.bg} px-5 py-4`}>
            <p className={`font-[family-name:var(--font-manrope)] text-3xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[#726e60] mt-1 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 3-column main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Project cards — 2 cols */}
        <div className="lg:col-span-2 space-y-5">
          {briefing.projectSprints.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#726e60]">Project Status</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {briefing.projectSprints.map((ps) => (
                  <ProjectSprintCard key={ps.projectId} ps={ps} slug={slug} />
                ))}
              </div>
            </div>
          )}

          {/* Team Workload full-width below project cards */}
          <Card>
            <CardHeader title="Team Workload" right={<span className="text-xs text-[#a19d90]">open issues</span>} />
            {briefing.teamWorkload.length === 0 ? (
              <EmptyState text="No open issues" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-[#ddd8c9]">
                {briefing.teamWorkload.map((w) => (
                  <WorkloadRow key={w.userId ?? "unassigned"} entry={w} max={briefing.teamWorkload[0]?.openCount ?? 1} slug={slug} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right rail — risk gates + blockers + overdue */}
        <div className="space-y-5">
          <RiskGatesWidget gates={openGates} staleGateIds={staleGateIds} mediumIssues={mediumRiskIssues} slug={slug} />
          <Card>
            <CardHeader
              title="Blockers"
              right={
                briefing.blockers.length > 0 ? (
                  <span className="rounded-full bg-[#fbeae8] px-2.5 py-0.5 text-xs font-semibold text-[#c0392b] border border-[#c0392b]/30">
                    {briefing.blockers.length}
                  </span>
                ) : null
              }
            />
            {briefing.blockers.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="text-lg">✅</span>
                <p className="text-sm text-[#4a473e]">No blocked issues — all clear.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#ddd8c9]">
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
                  <span className="rounded-full bg-[#fbeae8] px-2.5 py-0.5 text-xs font-semibold text-[#c0392b] border border-[#c0392b]/30">
                    {briefing.overdueIssues.length}
                  </span>
                }
              />
              <div className="divide-y divide-[#ddd8c9]">
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
  const healthCls = health === "blocked" ? "text-[#c0392b]" : health === "overdue" ? "text-[#c9791d]" : "text-[#3f7d4c]";
  const healthLabel = health === "blocked" ? `${ps.blockedCount} blocked` : health === "overdue" ? `${ps.overdueCount} overdue` : "On track";

  return (
    <Link href={`/${slug}/projects/${ps.projectKey}`}>
      <div className="rounded-xl border border-[#ddd8c9] bg-white p-4 hover:shadow-md hover:border-[#b7452f]/40 transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs font-bold text-[#726e60]">{ps.projectKey}</span>
          <span className={`text-xs font-semibold ${healthCls}`}>{healthLabel}</span>
        </div>
        <p className="text-sm font-semibold text-[#20201d] mb-2 line-clamp-1">{ps.projectName}</p>
        {ps.sprint ? (
          <>
            <p className="text-[10px] text-[#a19d90] mb-1">{ps.sprint.name}</p>
            <ProgressBar pct={ps.sprint.pctDone} color={health === "blocked" ? "#c0392b" : "#b7452f"} />
            <div className="mt-2 flex items-center justify-between text-[10px] text-[#a19d90]">
              <span>{ps.sprint.pctDone}% done</span>
              <span>{ps.sprint.daysLeft !== null ? `${ps.sprint.daysLeft}d left` : ""}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-[#a19d90]">No active sprint · {ps.openCount} open</p>
        )}
      </div>
    </Link>
  );
}

function WorkloadRow({ entry, max, slug }: { entry: WorkloadEntry; max: number; slug: string }) {
  const pct = max > 0 ? (entry.openCount / max) * 100 : 0;
  const href = `/${slug}/issues?assignee=${entry.userId ?? "none"}`;
  return (
    <Link href={href} className="block px-5 py-3 hover:bg-[#f4f2eb] transition-colors group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[#20201d] group-hover:text-[#b7452f] transition-colors">{entry.name}</span>
        <div className="flex items-center gap-2">
          {entry.blockedCount > 0 && (
            <span className="text-[10px] font-semibold text-[#c0392b] bg-[#fbeae8] px-1.5 py-0.5 rounded border border-[#c0392b]/30">
              {entry.blockedCount} blocked
            </span>
          )}
          {entry.urgentCount > 0 && (
            <span className="text-[10px] font-semibold text-[#c9791d] bg-[#fdf1de] px-1.5 py-0.5 rounded border border-[#c9791d]/30">
              {entry.urgentCount} urgent
            </span>
          )}
          <span className="text-xs font-bold text-[#4a473e] w-6 text-right">{entry.openCount}</span>
        </div>
      </div>
      <ProgressBar pct={pct} color="#b7452f" />
    </Link>
  );
}

function BlockerRow({ blocker, slug }: { blocker: BlockerIssue; slug: string }) {
  return (
    <Link
      href={`/${slug}/issues/${blocker.id}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-[#f4f2eb] transition-colors group"
    >
      <span className="font-mono text-[10px] text-[#a19d90] w-20 shrink-0">
        {blocker.projectKey}-{blocker.number}
      </span>
      <span className="flex-1 text-sm text-[#20201d] line-clamp-1 group-hover:text-[#b7452f] transition-colors">
        {blocker.title}
      </span>
      <div className="flex items-center gap-2 shrink-0 text-xs text-[#726e60]">
        <span>{blocker.assigneeName}</span>
        <span className="font-semibold text-[#c0392b]">{blocker.daysBlocked}d</span>
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
          { label: "Open",        value: s.totalOpen,       color: "text-[#20201d]",                                              bg: "bg-white" },
          { label: "Done",        value: s.totalDone,       color: "text-[#3f7d4c]",                                              bg: "bg-[#e9f3ea]" },
          { label: "In Progress", value: s.inProgressCount, color: "text-[#c9791d]",                                              bg: "bg-[#fdf1de]" },
          { label: "Blocked",     value: s.blocked,         color: s.blocked > 0     ? "text-[#c0392b]" : "text-[#a19d90]",    bg: s.blocked > 0     ? "bg-[#fbeae8]" : "bg-white" },
          { label: "Unassigned",  value: s.unassigned,      color: s.unassigned > 0  ? "text-[#c9791d]" : "text-[#a19d90]",    bg: s.unassigned > 0  ? "bg-[#fdf1de]"  : "bg-white" },
          { label: "Overdue",     value: s.overdueOpen,     color: s.overdueOpen > 0 ? "text-[#c0392b]" : "text-[#a19d90]",    bg: s.overdueOpen > 0 ? "bg-[#fbeae8]"    : "bg-white" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border border-[#ddd8c9] ${kpi.bg} px-5 py-4`}>
            <p className={`font-[family-name:var(--font-manrope)] text-3xl font-extrabold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-[#726e60] mt-1 uppercase tracking-wide">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Member Activity */}
        <Card>
          <CardHeader title="Member Activity" right={<span className="text-xs text-[#a19d90]">last 7 days</span>} />
          {briefing.memberActivity.length === 0 ? (
            <EmptyState text="No members" />
          ) : (
            <div className="divide-y divide-[#ddd8c9]">
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
                <span className="rounded-full bg-[#fbeae8] px-2.5 py-0.5 text-xs font-semibold text-[#c0392b] border border-[#c0392b]/30">
                  {briefing.blockers.length}
                </span>
              ) : null
            }
          />
          {briefing.blockers.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6">
              <span className="text-lg">✅</span>
              <p className="text-sm text-[#4a473e]">No blocked issues.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#ddd8c9]">
              {briefing.blockers.slice(0, 8).map((b) => (
                <BlockerRow key={b.id} blocker={b} slug={slug} />
              ))}
            </div>
          )}
        </Card>

        {/* Team Workload */}
        <Card>
          <CardHeader title="Team Workload" right={<Link href={`/${slug}/reports`} className="text-xs text-[#b7452f] hover:underline">Full report →</Link>} />
          {briefing.teamWorkload.length === 0 ? (
            <EmptyState text="No open issues" />
          ) : (
            <div className="divide-y divide-[#ddd8c9]">
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4ecf0] text-xs font-bold text-[#b7452f]">
        {member.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#20201d] truncate">{member.name}</p>
        <p className={`text-xs ${isQuiet ? "text-[#c9791d]" : "text-[#a19d90]"}`}>{member.lastActiveLabel}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-[#4a473e]">{member.issuesOwned}</p>
        <p className="text-[10px] text-[#a19d90]">owned</p>
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
  openGates,
  staleGateIds,
  mediumRiskIssues,
}: {
  slug: string;
  role: string;
  firstName: string;
  briefing: MorningBriefing;
  openGates: RiskGateWithIssue[];
  staleGateIds: Set<string>;
  mediumRiskIssues: MediumIssue[];
}) {
  const [activeTab, setActiveTab] = useState<RoleTab>(defaultTab(role));

  return (
    <div className="w-full px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[family-name:var(--font-manrope)] text-2xl font-extrabold text-[#20201d]">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm text-[#a19d90]">{dateLabel()} · Here&apos;s your day</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/${slug}/board`}
            className="rounded-lg border border-[#ddd8c9] bg-white px-4 py-2 text-sm font-medium text-[#4a473e] hover:bg-[#f4f2eb] transition-colors"
          >
            Board →
          </Link>
          <Link
            href={`/${slug}/issues`}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#f2e9d8] transition-colors"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}
          >
            All Issues →
          </Link>
        </div>
      </div>

      {/* Role tabs */}
      <div className="mb-6 flex gap-1 border-b border-[#ddd8c9]">
        {ROLE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === t.id
                ? "border-[#b7452f] text-[#20201d]"
                : "border-transparent text-[#726e60] hover:text-[#20201d]"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Views */}
      {activeTab === "developer" && <DeveloperView briefing={briefing} slug={slug} openGates={openGates} staleGateIds={staleGateIds} mediumRiskIssues={mediumRiskIssues} />}
      {activeTab === "pm"        && <PMView        briefing={briefing} slug={slug} openGates={openGates} staleGateIds={staleGateIds} mediumRiskIssues={mediumRiskIssues} />}
      {activeTab === "admin"     && <AdminView     briefing={briefing} slug={slug} />}
    </div>
  );
}
