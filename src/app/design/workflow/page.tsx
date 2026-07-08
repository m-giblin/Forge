"use client";
/* eslint-disable react/no-unescaped-entities -- design prototype */

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

// ══════════════════════════════════════════════════════════════
//  MOCK DATA
// ══════════════════════════════════════════════════════════════

const TEAM = [
  { id: "u1", name: "Matt Giblin",   initials: "MG", color: "#6366f1", role: "Lead Dev",  online: true  },
  { id: "u2", name: "Alex Chen",     initials: "AC", color: "#16a34a", role: "Developer", online: true  },
  { id: "u3", name: "Sarah Kim",     initials: "SK", color: "#ec4899", role: "Designer",  online: false },
  { id: "u4", name: "Jordan Lee",    initials: "JL", color: "#d97706", role: "Product",   online: true  },
  { id: "u5", name: "Casey Park",    initials: "CP", color: "#7c3aed", role: "Developer", online: false },
  { id: "u6", name: "Dana Walsh",    initials: "DW", color: "#0891b2", role: "QA Eng",    online: true  },
];
const teamById = Object.fromEntries(TEAM.map(m => [m.id, m]));

type Av = { id: string; size?: "xs"|"sm"|"md"|"lg" };
function Av({ id, size = "sm" }: Av) {
  const m = teamById[id] as typeof TEAM[0] | undefined;
  if (!m) return null;
  const cls = size === "xs" ? "w-5 h-5 text-[9px]" : size === "sm" ? "w-7 h-7 text-xs" : size === "md" ? "w-9 h-9 text-sm" : "w-11 h-11 text-base";
  return (
    <div className="relative inline-flex shrink-0">
      <span className={`inline-flex items-center justify-center rounded-full font-bold text-white ${cls}`} style={{ background: m.color }}>
        {m.initials}
      </span>
      {m.online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHARED PRIMITIVES
// ══════════════════════════════════════════════════════════════

function Pill({ label, color = "neutral" }: { label: string; color?: "neutral"|"indigo"|"emerald"|"amber"|"red"|"sky" }) {
  const cls: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-600 border-neutral-200",
    indigo:  "bg-indigo-50  text-indigo-700  border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber:   "bg-amber-50   text-amber-700   border-amber-200",
    red:     "bg-red-50     text-red-700     border-red-200",
    sky:     "bg-sky-50     text-sky-700     border-sky-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${cls[color]}`}>{label}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-neutral-200 ${className}`}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">{children}</div>;
}

// Reaction component
function Reactions({ items }: { items: { emoji: string; count: number; mine?: boolean }[] }) {
  const [reacted, setReacted] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map(i => [i.emoji, i.mine ?? false]))
  );
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(items.map(i => [i.emoji, i.count]))
  );
  const toggle = (emoji: string) => {
    setReacted(r => ({ ...r, [emoji]: !r[emoji] }));
    setCounts(c => ({ ...c, [emoji]: c[emoji] + (reacted[emoji] ? -1 : 1) }));
  };
  return (
    <div className="flex gap-1.5 flex-wrap">
      {items.map(i => (
        <button key={i.emoji} onClick={() => toggle(i.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
            reacted[i.emoji]
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-300"
          }`}>
          {i.emoji} <span className="font-medium">{counts[i.emoji]}</span>
        </button>
      ))}
      <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-neutral-300 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition">
        + React
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 1 — MORNING RITUAL (Developer day-start)
// ══════════════════════════════════════════════════════════════

function MorningRitualShell() {
  const [picked, setPicked] = useState<string | null>(null);
  const [digestOpen, setDigestOpen] = useState(true);

  const myWork = [
    { key: "FORGE-45", title: "Migrate rate limiter to Redis/Upstash", priority: "urgent", status: "blocked",     dueToday: false, estimate: "3h", blocker: "INFRA-15 · Waiting on Redis provision" },
    { key: "FORGE-52", title: "Make IMPERSONATION_SECRET mandatory",   priority: "high",   status: "in_progress", dueToday: true,  estimate: "1h", blocker: null },
    { key: "FORGE-47", title: "Issue export to CSV",                   priority: "medium", status: "todo",        dueToday: false, estimate: "3h", blocker: null },
  ];

  const watching = [
    { key: "INFRA-15", title: "Provision Upstash Redis", assignee: "u2", status: "todo",      change: "Alex just moved this to In Progress · 2m ago" },
    { key: "WEB-204",  title: "Fix destination picker iOS Safari", assignee: "u1", status: "in_review", change: "Jordan left 2 review comments · 1h ago" },
  ];

  const digest = [
    { icon: "🚀", text: "Sprint 6 is 68% complete — on track for Friday close" },
    { icon: "🔴", text: "FORGE-45 has been blocked for 5 days. INFRA-15 just started — unblock expected today" },
    { icon: "💬", text: "3 issues have unread comments that mention you" },
    { icon: "⚡", text: "Casey merged PR #91 — MOB-23 Android push deep-links fixed" },
  ];

  const priorityColor: Record<string, string> = {
    urgent: "text-red-600 bg-red-50 border-red-200",
    high: "text-orange-600 bg-orange-50 border-orange-200",
    medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
    low: "text-sky-600 bg-sky-50 border-sky-200",
  };

  const statusColor: Record<string, string> = {
    blocked:     "text-red-700    bg-red-50    border-red-200",
    todo:        "text-sky-700    bg-sky-50    border-sky-200",
    in_progress: "text-indigo-700 bg-indigo-50 border-indigo-200",
    in_review:   "text-amber-700  bg-amber-50  border-amber-200",
    done:        "text-emerald-700 bg-emerald-50 border-emerald-200",
  };
  const statusLabel: Record<string, string> = {
    blocked: "Blocked", todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done"
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left — My Work */}
      <div className="w-[380px] shrink-0 space-y-4">
        {/* AI Digest */}
        <Card>
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">✨</span>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Morning Digest</div>
                <div className="text-[11px] text-neutral-400">Saturday, June 21 · AI Summary</div>
              </div>
            </div>
            <button onClick={() => setDigestOpen(d => !d)}
              className="text-xs text-neutral-400 hover:text-neutral-700">
              {digestOpen ? "Hide" : "Show"}
            </button>
          </div>
          {digestOpen && (
            <div className="px-4 pb-4 space-y-2 border-t border-neutral-100 pt-3">
              {digest.map((d, i) => (
                <div key={i} className="flex gap-2 items-start text-sm">
                  <span className="text-base mt-0.5 shrink-0">{d.icon}</span>
                  <span className="text-neutral-700 leading-snug">{d.text}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* My Issues */}
        <Card>
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">My Work</div>
              <div className="text-[11px] text-neutral-400">{myWork.length} issues assigned to you</div>
            </div>
            <Pill label="Sprint 6" color="indigo" />
          </div>
          <div className="divide-y divide-neutral-50">
            {myWork.map(issue => (
              <button key={issue.key} onClick={() => setPicked(picked === issue.key ? null : issue.key)}
                className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition ${picked === issue.key ? "bg-indigo-50" : ""}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${priorityColor[issue.priority]}`}>
                    {issue.priority.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 leading-snug truncate">{issue.title}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-neutral-400">{issue.key}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusColor[issue.status]}`}>{statusLabel[issue.status]}</span>
                      {issue.dueToday && <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-red-50 text-red-700 border-red-200">Due today</span>}
                      <span className="text-[10px] text-neutral-400">~{issue.estimate}</span>
                    </div>
                    {issue.blocker && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 px-2 py-1 rounded">
                        <span>⛔</span> {issue.blocker}
                      </div>
                    )}
                  </div>
                </div>
                {picked === issue.key && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 flex gap-2 flex-wrap">
                    <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition">Open Issue</button>
                    <button className="px-3 py-1.5 rounded-lg bg-white text-neutral-700 text-xs font-medium border border-neutral-200 hover:bg-neutral-50 transition">Create Branch</button>
                    <button className="px-3 py-1.5 rounded-lg bg-white text-neutral-700 text-xs font-medium border border-neutral-200 hover:bg-neutral-50 transition">Start Timer</button>
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Watching */}
        <Card>
          <div className="px-4 py-3 border-b border-neutral-100">
            <div className="text-sm font-semibold text-neutral-900">Watching</div>
            <div className="text-[11px] text-neutral-400">Issues you're subscribed to</div>
          </div>
          <div className="divide-y divide-neutral-50">
            {watching.map(w => (
              <div key={w.key} className="px-4 py-3 hover:bg-neutral-50 transition cursor-pointer">
                <div className="flex items-center gap-2">
                  <Av id={w.assignee} size="xs" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-neutral-900 truncate">{w.title}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{w.change}</div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusColor[w.status]}`}>{statusLabel[w.status]}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right — Sprint Health */}
      <div className="flex-1 space-y-4">
        {/* Sprint burn-down card */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Sprint 6 Health</div>
              <div className="text-[11px] text-neutral-400">Closes Friday · 4 days remaining</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600">68%</div>
                <div className="text-[10px] text-neutral-400">Done</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-600">2</div>
                <div className="text-[10px] text-neutral-400">Blocked</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-600">3</div>
                <div className="text-[10px] text-neutral-400">At risk</div>
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "68%" }} />
          </div>
          {/* Sprint issues grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "FORGE-45", title: "Migrate rate limiter", assignee: "u1", status: "blocked" },
              { key: "FORGE-46", title: "Stripe webhook retry", assignee: "u2", status: "in_review" },
              { key: "WEB-204",  title: "Fix destination picker iOS", assignee: "u1", status: "in_progress" },
              { key: "FORGE-47", title: "Issue export to CSV", assignee: "u1", status: "todo" },
              { key: "MOB-23",   title: "Push notification deep-links", assignee: "u5", status: "done" },
              { key: "INFRA-15", title: "Provision Upstash Redis", assignee: "u2", status: "in_progress" },
              { key: "WEB-198",  title: "Dark mode design pass", assignee: "u3", status: "in_progress" },
              { key: "FORGE-52", title: "Make IMPERSONATION_SECRET mandatory", assignee: "u1", status: "in_progress" },
            ].map(i => (
              <div key={i.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-100 bg-neutral-50 hover:bg-white hover:border-neutral-200 transition cursor-pointer">
                <Av id={i.assignee} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-neutral-700 truncate">{i.title}</div>
                  <div className="text-[10px] text-neutral-400">{i.key}</div>
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  i.status === "done" ? "bg-emerald-500" :
                  i.status === "blocked" ? "bg-red-500" :
                  i.status === "in_review" ? "bg-amber-400" :
                  i.status === "in_progress" ? "bg-indigo-500" : "bg-sky-400"
                }`} />
              </div>
            ))}
          </div>
        </Card>

        {/* Team availability */}
        <Card className="p-4">
          <SectionLabel>Team — now online</SectionLabel>
          <div className="flex gap-4 flex-wrap">
            {TEAM.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <Av id={m.id} size="sm" />
                <div>
                  <div className="text-xs font-medium text-neutral-800">{m.name}</div>
                  <div className="text-[10px] text-neutral-400">{m.online ? "Active now" : "Away"}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Forge gap callout */}
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚡</span>
            <div>
              <div className="text-sm font-bold text-amber-800 mb-1">Gap vs. Linear Pulse (shipped April 2025)</div>
              <p className="text-sm text-amber-800 leading-relaxed">
                Linear's "Pulse" feature sends a personalized AI-generated digest at 7am local time with audio option. It eliminates the standup for async teams.
                <strong> Forge has nothing like this.</strong> Our "Morning Digest" above is a mockup of what we should build —
                a daily AI brief that surfaces YOUR issues, blockers, and relevant team changes. This is table stakes for 2025.
              </p>
              <div className="mt-2 text-xs font-semibold text-amber-700">Recommendation: ship a morning digest card (AI-generated, no audio needed in v1) before we compete with Linear.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 2 — COLLABORATION (rich comments, decisions, @mentions)
// ══════════════════════════════════════════════════════════════

type CommentType = "comment" | "decision" | "activity";
type Comment = {
  id: number;
  author: string;
  text: string;
  time: string;
  type: CommentType;
  reactions?: { emoji: string; count: number; mine?: boolean }[];
  resolved?: boolean;
  decisionText?: string;
};

function CollaborationShell() {
  const [comments, setComments] = useState<Comment[]>([
    { id: 1, author: "u4", type: "comment", time: "3 days ago", text: "Is there a rollback plan if this breaks the auth flow? We had an incident last quarter where a rate-limit bug took down logins for 20 minutes.", reactions: [{ emoji: "👍", count: 3, mine: true }, { emoji: "🎯", count: 1 }] },
    { id: 2, author: "u2", type: "comment", time: "3 days ago", text: "@Matt Giblin @Jordan Lee — I'll add a feature flag `RATE_LIMITER_ENABLED` so we can disable it instantly if needed. Flag defaults OFF in prod until we verify.", reactions: [{ emoji: "💯", count: 2 }] },
    { id: 3, author: "u1", type: "decision", time: "2 days ago", text: "After reviewing the options, here's the call:", decisionText: "We will use Upstash Redis with the `@upstash/ratelimit` SDK. Feature flag `RATE_LIMITER_ENABLED` defaults to false in production. INFRA-15 is the dependency — Matt will unblock as soon as Alex provisions the cluster.", resolved: false, reactions: [{ emoji: "✅", count: 4, mine: true }] },
    { id: 4, author: "u5", type: "activity", time: "1 day ago", text: "Casey changed status from Todo → Blocked · waiting on INFRA-15", reactions: [] },
    { id: 5, author: "u2", type: "comment", time: "2h ago", text: "Update: INFRA-15 is now In Progress. I've provisioned the test cluster in staging. Sharing the env vars via 1Password — check the `Forge Staging` vault.", reactions: [{ emoji: "🚀", count: 2 }] },
  ]);

  const [draft, setDraft] = useState("");
  const [postAs, setPostAs] = useState<"comment" | "decision">("comment");
  const [watching, setWatching] = useState(true);

  const submit = () => {
    if (!draft.trim()) return;
    setComments(prev => [...prev, {
      id: prev.length + 1,
      author: "u1",
      type: postAs,
      time: "just now",
      text: draft,
      ...(postAs === "decision" ? { decisionText: draft } : {}),
      reactions: [],
    }]);
    setDraft("");
  };

  return (
    <div className="flex gap-4">
      {/* Issue panel */}
      <div className="flex-1 max-w-[640px] space-y-4">
        {/* Issue header */}
        <Card>
          <div className="p-4 border-b border-neutral-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-neutral-400">FORGE-45</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-red-50 text-red-700 border-red-200">Blocked</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-red-50 text-red-700 border-red-200">Urgent</span>
            </div>
            <h2 className="text-lg font-bold text-neutral-900">Migrate rate limiter to Redis/Upstash</h2>
            <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
              The in-memory rate limiter resets on every deploy. In a multi-instance production environment this is security theater — trivially bypassed by hitting a different pod. Needs Redis for shared state.
            </p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Av id="u1" size="xs" />
                <span className="text-xs text-neutral-600">Matt Giblin</span>
              </div>
              <span className="text-xs text-neutral-400">Estimate: 3h</span>
              <span className="text-xs text-neutral-400">Sprint 6</span>
              <button onClick={() => setWatching(w => !w)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition ${watching ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}>
                {watching ? "👁 Watching" : "👁 Watch"}
              </button>
            </div>
          </div>

          {/* Provenance strip */}
          <div className="px-4 py-2 bg-violet-50 border-b border-violet-100 flex items-center gap-2 text-xs">
            <span className="text-violet-600">💡</span>
            <span className="text-violet-700 font-medium">From Think Tank:</span>
            <span className="text-violet-600">"Security Hardening Initiative" · Signed off by Matt Giblin · 14 days ago</span>
            <button className="ml-auto text-violet-600 underline hover:text-violet-800">View decisions →</button>
          </div>

          {/* PR linkage */}
          <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2 text-xs">
            <span className="text-neutral-400">🔗</span>
            <span className="text-neutral-600">PR #87 — feat/redis-rate-limiter</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-200">Draft</span>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-500">Blocked by INFRA-15 merge</span>
          </div>
        </Card>

        {/* Comments */}
        <Card>
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-900">Discussion</div>
            <div className="flex gap-2">
              <button className="text-xs text-neutral-500 hover:text-neutral-800">Oldest first</button>
              <button className="text-xs text-neutral-500 hover:text-neutral-800">Filter decisions</button>
            </div>
          </div>
          <div className="divide-y divide-neutral-50">
            {comments.map(c => (
              <div key={c.id} className={`px-4 py-4 ${c.type === "decision" ? "bg-violet-50 border-l-2 border-violet-400" : c.type === "activity" ? "bg-neutral-50" : ""}`}>
                <div className="flex items-start gap-3">
                  {c.type === "activity" ? (
                    <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-xs">⚡</div>
                  ) : (
                    <Av id={c.author} size="sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {c.type !== "activity" && (
                        <span className="text-sm font-semibold text-neutral-900">
                          {teamById[c.author]?.name}
                        </span>
                      )}
                      {c.type === "decision" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold border border-violet-200">
                          💡 Decision
                        </span>
                      )}
                      <span className="text-[11px] text-neutral-400">{c.time}</span>
                    </div>
                    {c.type === "activity" ? (
                      <p className="text-xs text-neutral-500 italic">{c.text}</p>
                    ) : c.type === "decision" ? (
                      <div>
                        <p className="text-sm text-neutral-700 mb-2 leading-relaxed">{c.text}</p>
                        {c.decisionText && (
                          <div className="bg-white border border-violet-200 rounded-lg p-3 text-sm text-violet-900 leading-relaxed">
                            {c.decisionText}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-700 leading-relaxed">{c.text}</p>
                    )}
                    {c.reactions && c.reactions.length > 0 && (
                      <div className="mt-2">
                        <Reactions items={c.reactions} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Compose */}
          <div className="px-4 py-4 border-t border-neutral-100">
            <div className="flex gap-2 mb-2">
              <Av id="u1" size="sm" />
              <div className="flex-1">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Leave a comment or decision... Use @name to mention someone"
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  rows={3}
                />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden text-xs">
                    <button onClick={() => setPostAs("comment")}
                      className={`px-3 py-1.5 font-medium transition ${postAs === "comment" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}>
                      💬 Comment
                    </button>
                    <button onClick={() => setPostAs("decision")}
                      className={`px-3 py-1.5 font-medium transition ${postAs === "decision" ? "bg-violet-600 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}>
                      💡 Decision
                    </button>
                  </div>
                  <button onClick={submit}
                    className="ml-auto px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition">
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right sidebar — meta & gap callouts */}
      <div className="w-[280px] shrink-0 space-y-4">
        {/* Watching sidebar */}
        <Card className="p-4">
          <SectionLabel>Subscribers (watching)</SectionLabel>
          <div className="flex gap-1.5 flex-wrap">
            {["u1","u2","u4","u6"].map(id => <Av key={id} id={id} size="sm" />)}
            <button className="w-7 h-7 rounded-full border-2 border-dashed border-neutral-300 text-neutral-400 text-xs flex items-center justify-center hover:border-neutral-400 transition">+</button>
          </div>
        </Card>

        {/* Decisions timeline */}
        <Card className="p-4">
          <SectionLabel>Decision Log</SectionLabel>
          <div className="space-y-3">
            {[
              { text: "Use Upstash Redis + @upstash/ratelimit SDK", by: "u1", ago: "2 days ago" },
              { text: "Feature flag RATE_LIMITER_ENABLED defaults OFF in prod", by: "u1", ago: "2 days ago" },
            ].map((d, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-[10px] shrink-0">💡</div>
                <div>
                  <div className="text-xs text-neutral-800 leading-snug">{d.text}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{teamById[d.by]?.name} · {d.ago}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Gap callout */}
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <div className="text-xs font-bold text-red-800 mb-2">🔥 Gap Callout — No Decision Primitive Exists Anywhere</div>
          <p className="text-xs text-red-700 leading-relaxed">
            Linear, Jira, Asana, GitHub Issues — <em>none of them</em> have a first-class "Decision" post type.
            Decisions get buried in comment threads, lost forever. <br /><br />
            <strong>Forge should own this.</strong> Think Tank already captures WHY — we need to surface it inside tickets as a Decision type on comments. No competitor has shipped this. It's a genuine differentiator.
          </p>
        </div>

        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="text-xs font-bold text-amber-800 mb-2">⚡ Gap Callout — Watching/Subscribing</div>
          <p className="text-xs text-amber-700 leading-relaxed">
            Forge has no way to "watch" an issue you don't own. Only assignees get updates. This breaks the PM workflow —
            a PM who created the ticket but assigned it to a dev loses visibility the moment they click away.
            <strong> Every competitor has a subscribe/watch mechanic.</strong> This is a must-have before GA.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 3 — NOTIFICATION CENTER
// ══════════════════════════════════════════════════════════════

type NotifCategory = "all"|"mentions"|"assignments"|"decisions"|"sprint";
type Notif = {
  id: number; category: Omit<NotifCategory, "all">; icon: string; title: string; detail: string;
  time: string; read: boolean; issueKey?: string; author?: string; actionable?: boolean;
};

function NotificationShell() {
  const [category, setCategory] = useState<NotifCategory>("all");
  const [notifs, setNotifs] = useState<Notif[]>([
    { id: 1,  category: "mentions",    icon: "💬", title: "Alex Chen mentioned you",           detail: "@Matt Giblin — sharing env vars via 1Password. Check Forge Staging vault.", time: "2h ago",    read: false, issueKey: "FORGE-45", author: "u2", actionable: true },
    { id: 2,  category: "decisions",   icon: "💡", title: "New decision on FORGE-45",           detail: "Matt Giblin posted a decision: Use Upstash Redis with @upstash/ratelimit SDK.",  time: "2 days ago", read: false, issueKey: "FORGE-45", author: "u1", actionable: false },
    { id: 3,  category: "assignments", icon: "📌", title: "FORGE-52 assigned to you",           detail: "Jordan Lee assigned SEC-05: Make IMPERSONATION_SECRET mandatory.",                time: "1 day ago",  read: false, issueKey: "FORGE-52", author: "u4", actionable: true },
    { id: 4,  category: "sprint",      icon: "🚀", title: "Sprint 6 is 68% complete",          detail: "Sprint closes Friday. 2 issues blocked, 3 in review. You have 1 open item due today.", time: "6h ago",   read: true,  actionable: false },
    { id: 5,  category: "mentions",    icon: "💬", title: "Jordan Lee mentioned you",           detail: "@Matt — can you review WEB-204? The iOS fix looks good on my end.",               time: "1h ago",     read: false, issueKey: "WEB-204", author: "u4", actionable: true },
    { id: 6,  category: "assignments", icon: "✅", title: "INFRA-15 moved to In Progress",      detail: "Alex Chen just started provisioning Upstash Redis. FORGE-45 will unblock today.",  time: "30m ago",    read: false, issueKey: "INFRA-15", author: "u2", actionable: false },
    { id: 7,  category: "sprint",      icon: "⚠️", title: "MOB-23 is 3 days overdue",          detail: "Casey Park has this in progress. Last update was 3 days ago — might need a nudge.", time: "2h ago",    read: true,  issueKey: "MOB-23", actionable: true },
    { id: 8,  category: "decisions",   icon: "💡", title: "Retroactive sign-off request",      detail: "Dana Walsh needs your approval on the security hardening scope change.",            time: "4h ago",    read: false, actionable: true },
  ]);

  const markRead = (id: number) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));

  const filtered = category === "all" ? notifs : notifs.filter(n => n.category === category);
  const unreadCount = notifs.filter(n => !n.read).length;

  const cats: { key: NotifCategory; label: string; icon: string }[] = [
    { key: "all",         label: "All",         icon: "🔔" },
    { key: "mentions",    label: "Mentions",    icon: "💬" },
    { key: "assignments", label: "Assignments", icon: "📌" },
    { key: "decisions",   label: "Decisions",   icon: "💡" },
    { key: "sprint",      label: "Sprint",      icon: "🏃" },
  ];

  return (
    <div className="flex gap-4">
      {/* Notification panel */}
      <div className="w-[480px] shrink-0">
        <Card>
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Notifications</div>
                <div className="text-[11px] text-neutral-400">{unreadCount} unread</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Mark all read</button>
              <button className="text-xs text-neutral-500 hover:text-neutral-700">Settings</button>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-neutral-100 overflow-x-auto">
            {cats.map(c => {
              const count = c.key === "all" ? unreadCount : notifs.filter(n => n.category === c.key && !n.read).length;
              return (
                <button key={c.key} onClick={() => setCategory(c.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    category === c.key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}>
                  {c.icon} {c.label}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                      category === c.key ? "bg-white text-neutral-900" : "bg-red-500 text-white"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="divide-y divide-neutral-50 max-h-[520px] overflow-y-auto">
            {filtered.map(n => (
              <div key={n.id}
                className={`px-4 py-3 hover:bg-neutral-50 transition cursor-pointer flex gap-3 ${!n.read ? "bg-indigo-50/30" : ""}`}
                onClick={() => markRead(n.id)}>
                <div className="w-9 h-9 rounded-full bg-white border border-neutral-100 flex items-center justify-center text-base shrink-0 shadow-sm">
                  {n.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold text-neutral-800 leading-snug">{n.title}</div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{n.detail}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {n.issueKey && <span className="text-[10px] text-neutral-400 font-mono">{n.issueKey}</span>}
                    <span className="text-[10px] text-neutral-400">{n.time}</span>
                    {n.actionable && (
                      <div className="ml-auto flex gap-1.5">
                        <button className="text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">View</button>
                        {n.category === "assignments" && <button className="text-[10px] px-2 py-0.5 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition">Reassign</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right — settings + gap callout */}
      <div className="flex-1 space-y-4">
        {/* Notification preferences mockup */}
        <Card className="p-4">
          <SectionLabel>Notification Preferences</SectionLabel>
          <div className="space-y-3 mt-2">
            {[
              { label: "Direct @mentions",          in_app: true,  email: true,  digest: false },
              { label: "Assigned to me",             in_app: true,  email: true,  digest: false },
              { label: "My issue status changes",    in_app: true,  email: false, digest: true  },
              { label: "Issues I'm watching",        in_app: true,  email: false, digest: true  },
              { label: "Decision posts",             in_app: true,  email: true,  digest: false },
              { label: "Sprint health updates",      in_app: false, email: false, digest: true  },
              { label: "Team member PR merges",      in_app: false, email: false, digest: false },
            ].map((pref, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center py-2 border-b border-neutral-50 last:border-0">
                <div className="text-xs text-neutral-700">{pref.label}</div>
                {["in_app", "email", "digest"].map(ch => {
                  const on = pref[ch as keyof typeof pref] as boolean;
                  return (
                    <div key={ch} className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-4 rounded-full transition ${on ? "bg-indigo-500" : "bg-neutral-200"}`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm mt-0.5 transition-all ${on ? "ml-4" : "ml-0.5"}`} />
                      </div>
                      <span className="text-[9px] text-neutral-400 uppercase">{ch === "in_app" ? "App" : ch === "email" ? "Email" : "Digest"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Gap callout */}
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <div className="text-sm font-bold text-red-800 mb-2">🔥 Forge Has No Notification Center At All</div>
          <p className="text-sm text-red-700 leading-relaxed mb-2">
            Right now Forge shows inbox items — but there's no bell icon, no unread count in the nav, no way to categorize what kind of notification it is, and no email notifications.
            This means a developer assigned to an urgent issue has no way to know unless they happen to open Forge. <strong>That's broken.</strong>
          </p>
          <p className="text-sm text-red-700 leading-relaxed">
            Linear's inbox model — notifications as actionable items you can "done" — is the best in class. Jira's notification system is universally hated (too much noise, no categorization).
            Forge should build the inbox model from day one, not bolt it on later.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 4 — COMMAND PALETTE
// ══════════════════════════════════════════════════════════════

function CommandPaletteShell() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const recentIssues = [
    { key: "FORGE-45", title: "Migrate rate limiter to Redis/Upstash",   type: "bug",     status: "blocked" },
    { key: "FORGE-52", title: "Make IMPERSONATION_SECRET mandatory",       type: "chore",   status: "in_progress" },
    { key: "WEB-204",  title: "Fix destination picker on mobile Safari",   type: "bug",     status: "in_progress" },
    { key: "INFRA-15", title: "Provision Upstash Redis + wire env vars",   type: "chore",   status: "in_progress" },
  ];

  const quickActions = [
    { icon: "➕", label: "Create new issue",      shortcut: "C",         color: "text-indigo-600" },
    { icon: "🔍", label: "Search all issues",      shortcut: "/",         color: "text-sky-600" },
    { icon: "📋", label: "My issues",              shortcut: "M",         color: "text-neutral-600" },
    { icon: "🏃", label: "Sprint board",           shortcut: "S B",       color: "text-emerald-600" },
    { icon: "💡", label: "New Think Tank idea",    shortcut: "T",         color: "text-violet-600" },
    { icon: "👁", label: "Switch project",         shortcut: "P",         color: "text-neutral-600" },
  ];

  const typeColor: Record<string, string> = { bug: "text-red-500", feature: "text-indigo-500", chore: "text-neutral-400", task: "text-sky-500" };
  const typeIcon: Record<string, string> = { bug: "⬤", feature: "◆", chore: "⚙", task: "◻" };

  const filteredIssues = query
    ? recentIssues.filter(i => i.title.toLowerCase().includes(query.toLowerCase()) || i.key.toLowerCase().includes(query.toLowerCase()))
    : recentIssues;

  return (
    <div className="space-y-6">
      {/* Explainer */}
      <div className="flex gap-4 flex-wrap items-start">
        <Card className="p-4 flex-1 min-w-[300px]">
          <SectionLabel>Command Palette — ⌘K</SectionLabel>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Press <kbd className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-xs font-mono">⌘K</kbd> anywhere in Forge to open the command palette.
            Search issues, jump to projects, run quick actions — all without touching the mouse.
            <br /><br />
            <strong>Linear does this exceptionally well</strong> — their keyboard-first design is why developers love it. <strong>Forge has no command palette.</strong> This is a table-stakes feature for any tool targeting engineers.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { key: "C",   action: "Create issue" },
              { key: "⌘K", action: "Open palette" },
              { key: "E",   action: "Set estimate" },
              { key: "P",   action: "Set priority" },
              { key: "A",   action: "Assign" },
              { key: "L",   action: "Add label" },
              { key: "M",   action: "My issues" },
              { key: "T",   action: "Think Tank" },
            ].map(s => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[11px] font-mono text-neutral-700">{s.key}</kbd>
                <span className="text-neutral-600">{s.action}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 w-[280px] shrink-0">
          <div className="text-xs font-bold text-red-800 mb-2">🔥 Gap: No Command Palette</div>
          <p className="text-xs text-red-700 leading-relaxed">
            Forge has zero keyboard shortcuts beyond the browser defaults. Linear, GitHub, Shortcut all ship with command palettes on day one. For a product targeting developers who live in VS Code and terminal, a mouse-first interface is a dealbreaker.
            <br /><br />
            <strong>This needs to ship before public launch.</strong>
          </p>
        </div>
      </div>

      {/* Command palette mockup */}
      {open && (
        <div className="relative">
          <div className="absolute inset-0 bg-neutral-900/20 rounded-2xl -m-4" />
          <div className="relative mx-auto max-w-[600px]">
            <Card className="overflow-hidden shadow-2xl border-neutral-300">
              {/* Search bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200">
                <span className="text-neutral-400 text-sm">🔍</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search issues, projects, people... or type a command"
                  className="flex-1 text-sm text-neutral-900 placeholder-neutral-400 outline-none bg-transparent"
                />
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-500">Esc</kbd>
              </div>

              {/* Quick actions */}
              {!query && (
                <div className="px-3 py-2 border-b border-neutral-100">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 px-2 mb-1">Quick Actions</div>
                  {quickActions.map((a, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100 cursor-pointer ${i === 0 ? "bg-indigo-50 ring-1 ring-indigo-200" : ""}`}>
                      <span className={`text-base ${a.color}`}>{a.icon}</span>
                      <span className="text-sm text-neutral-800 flex-1">{a.label}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-500">{a.shortcut}</kbd>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent / filtered issues */}
              <div className="px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 px-2 mb-1">
                  {query ? `Issues matching "${query}"` : "Recent Issues"}
                </div>
                {filteredIssues.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-neutral-400 text-center">No results for "{query}"</div>
                ) : filteredIssues.map((issue, i) => (
                  <div key={issue.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100 cursor-pointer ${i === 0 && query ? "bg-indigo-50 ring-1 ring-indigo-200" : ""}`}>
                    <span className={`text-xs ${typeColor[issue.type]}`}>{typeIcon[issue.type]}</span>
                    <span className="text-xs font-mono text-neutral-400 w-[72px] shrink-0">{issue.key}</span>
                    <span className="text-sm text-neutral-800 flex-1 truncate">{issue.title}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-neutral-100 flex items-center gap-4 text-[10px] text-neutral-400">
                <span><kbd className="px-1 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-500">↑↓</kbd> Navigate</span>
                <span><kbd className="px-1 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-500">↵</kbd> Select</span>
                <span><kbd className="px-1 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-500">Esc</kbd> Close</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 5 — ONBOARDING (New member joining mid-flight)
// ══════════════════════════════════════════════════════════════

function OnboardingShell() {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Forge — Acme Corp",
      subtitle: "Jordan Lee invited you to join as Developer",
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl p-6 text-white">
            <div className="text-2xl font-bold mb-1">👋 Hey Dana!</div>
            <div className="text-indigo-100 text-sm">You've been invited to join Acme Corp's workspace.</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ n: "6", label: "Active projects" }, { n: "42", label: "Open issues" }, { n: "5", label: "Teammates" }].map(s => (
              <Card key={s.label} className="p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600">{s.n}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{s.label}</div>
              </Card>
            ))}
          </div>
          <div className="text-sm text-neutral-600">Here's what's happening on the team right now:</div>
          <div className="space-y-2">
            {[
              "🏃 Sprint 6 is in progress — closes Friday",
              "🔴 FORGE-45 is blocked — Alex is fixing the dependency today",
              "🎉 MOB-23 just got merged — Casey fixed the Android push links",
            ].map((t, i) => (
              <div key={i} className="flex gap-2 items-center text-sm text-neutral-700 bg-neutral-50 rounded-lg px-3 py-2">
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: "Your Team",
      subtitle: "Get to know the people you're working with",
      content: (
        <div className="space-y-3">
          {TEAM.slice(0, 5).map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition cursor-pointer">
              <Av id={m.id} size="md" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-neutral-900">{m.name}</div>
                <div className="text-xs text-neutral-500">{m.role} · {m.online ? "Online now" : "Away"}</div>
              </div>
              <button className="text-xs px-3 py-1 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-white">Message</button>
            </div>
          ))}
        </div>
      )
    },
    {
      title: "Active Projects",
      subtitle: "Pick a project to get started",
      content: (
        <div className="space-y-3">
          {[
            { name: "Forge Issue Tracker", key: "FORGE", issues: 12, sprint: "Sprint 6", role: "Suggested for you" },
            { name: "Travli Web App",       key: "WEB",   issues: 8,  sprint: "Sprint 6", role: "Also active" },
            { name: "Platform Infra",       key: "INFRA", issues: 3,  sprint: "Sprint 6", role: "DevOps" },
          ].map(p => (
            <div key={p.key} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">{p.key[0]}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-neutral-900">{p.name}</div>
                <div className="text-xs text-neutral-500">{p.issues} open issues · {p.sprint}</div>
              </div>
              <Pill label={p.role} color={p.role === "Suggested for you" ? "indigo" : "neutral"} />
            </div>
          ))}
        </div>
      )
    },
    {
      title: "Your First Issue",
      subtitle: "Suggested based on your role and skills",
      content: (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
            💡 We picked an issue that's well-scoped, well-described, and not blocking anything — a good way to get familiar with the codebase.
          </div>
          <Card className="p-4 border-2 border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <Pill label="FORGE-48" color="neutral" />
              <Pill label="Medium" color="amber" />
            </div>
            <div className="text-base font-semibold text-neutral-900 mb-2">Fix flaky isolation test for idea_signoffs</div>
            <div className="text-sm text-neutral-600 leading-relaxed mb-3">
              The test intermittently fails due to race conditions in the sign-off RLS check. Good first issue — isolated scope, clear failure reproduction steps in the description.
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs text-violet-800 mb-3">
              <span className="font-semibold">Why this exists:</span> From Think Tank — "Security Hardening Initiative" · The signoff model is a core trust mechanism in multi-tenant RLS. A flaky test means we can't rely on the green build.
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">Claim this issue</button>
              <button className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition">Show me more</button>
            </div>
          </Card>
        </div>
      )
    },
  ];

  const current = steps[step];

  return (
    <div className="flex gap-4">
      {/* Onboarding wizard */}
      <div className="flex-1 max-w-[560px]">
        <Card className="overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-neutral-100">
            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>

          <div className="p-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4">
              {steps.map((_, i) => (
                <button key={i} onClick={() => setStep(i)}
                  className={`transition ${i === step ? "w-6 h-2 rounded-full bg-indigo-500" : "w-2 h-2 rounded-full bg-neutral-200 hover:bg-neutral-300"}`} />
              ))}
              <span className="ml-auto text-xs text-neutral-400">{step + 1} of {steps.length}</span>
            </div>

            <h2 className="text-xl font-bold text-neutral-900 mb-1">{current.title}</h2>
            <p className="text-sm text-neutral-500 mb-6">{current.subtitle}</p>

            <div>{current.content}</div>

            <div className="flex gap-2 mt-6">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition">
                  Back
                </button>
              )}
              {step < steps.length - 1 ? (
                <button onClick={() => setStep(s => s + 1)}
                  className="ml-auto px-6 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">
                  Next →
                </button>
              ) : (
                <button onClick={() => setStep(0)}
                  className="ml-auto px-6 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
                  Start working 🚀
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Gap callouts */}
      <div className="w-[280px] shrink-0 space-y-4">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <div className="text-xs font-bold text-red-800 mb-2">🔥 Gap: Forge Has Zero Onboarding</div>
          <p className="text-xs text-red-700 leading-relaxed">
            When a new user joins a Forge workspace today, they land on an empty dashboard with no context. No welcome, no team intro, no suggested first issue. <strong>Every single competitor handles this better.</strong>
            <br/><br/>
            Asana uses templates. GitHub uses "good first issue" labels. Linear surfaces active cycles. Forge drops users cold.
          </p>
        </div>
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="text-xs font-bold text-amber-800 mb-2">⚡ Forge Opportunity: Best Onboarding by Far</div>
          <p className="text-xs text-amber-700 leading-relaxed">
            Because Forge knows the WHY behind every issue (Think Tank provenance), we can build the most context-rich onboarding in the category. A new developer doesn't just see what to work on — they see WHY it matters and the decisions that led to it. <strong>No competitor can do this.</strong>
          </p>
        </div>
        <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4">
          <div className="text-xs font-bold text-indigo-800 mb-2">💡 Recommended First Action</div>
          <p className="text-xs text-indigo-700 leading-relaxed">
            Build the onboarding flow as a 4-step wizard that shows up for any new workspace member. Steps: Welcome brief → Meet the team → Pick a project → Claim first issue. 3-4 days of engineering work, massive impact on activation rate.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 6 — STAKEHOLDER / EXECUTIVE VIEW
// ══════════════════════════════════════════════════════════════

function StakeholderShell() {
  const [projectFilter, setProjectFilter] = useState("all");

  const projects = [
    { key: "FORGE", name: "Forge Issue Tracker", status: "on_track",  health: 68, milestone: "Beta launch", due: "Jul 15", risk: null },
    { key: "WEB",   name: "Travli Web App",       status: "at_risk",   health: 52, milestone: "Mobile v2",   due: "Jun 30", risk: "Dark mode blocking 3 dependent features" },
    { key: "MOB",   name: "Travli Mobile",        status: "on_track",  health: 81, milestone: "App Store push fix", due: "Jun 25", risk: null },
    { key: "INFRA", name: "Platform Infra",       status: "blocked",   health: 34, milestone: "Redis provision", due: "Jun 22", risk: "Blocking 2 production security patches" },
  ];

  const statusCfg: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
    on_track: { label: "On Track", dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-800", border: "border-emerald-200" },
    at_risk:  { label: "At Risk",  dot: "bg-amber-400",   bg: "bg-amber-50",    text: "text-amber-800",   border: "border-amber-200"   },
    blocked:  { label: "Blocked",  dot: "bg-red-500",     bg: "bg-red-50",      text: "text-red-800",     border: "border-red-200"     },
  };

  const filtered = projectFilter === "all" ? projects : projects.filter(p => p.key === projectFilter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Executive Summary — Acme Corp</h2>
          <div className="text-sm text-neutral-500 mt-0.5">Week of June 21, 2026 · Auto-generated from sprint data</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {[{ key: "all", label: "All" }, ...projects.map(p => ({ key: p.key, label: p.key }))].map(f => (
              <button key={f.key} onClick={() => setProjectFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${projectFilter === f.key ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition">Export PDF</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Projects On Track",  value: "2 / 4",   sub: "Infra blocked, Web at risk", color: "text-amber-600" },
          { label: "Open Blockers",      value: "3",        sub: "2 security, 1 UX",          color: "text-red-600"   },
          { label: "Sprint Completion",  value: "68%",      sub: "Sprint 6 · closes Fri",     color: "text-indigo-600"},
          { label: "Est. Delivery Risk", value: "Medium",   sub: "INFRA-15 is critical path", color: "text-amber-600" },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs font-semibold text-neutral-700 mt-1">{k.label}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Project health cards */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(p => {
          const s = statusCfg[p.status];
          return (
            <Card key={p.key} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{p.name}</div>
                  <div className="text-xs text-neutral-400">{p.key}</div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                </span>
              </div>

              {/* Health bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                  <span>Sprint progress</span>
                  <span className="font-semibold">{p.health}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p.health >= 70 ? "bg-emerald-500" : p.health >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                    style={{ width: `${p.health}%` }} />
                </div>
              </div>

              <div className="text-xs text-neutral-600">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-neutral-400">Milestone</span>
                  <span className="font-medium">{p.milestone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Target date</span>
                  <span className={`font-medium ${new Date(p.due) < new Date() ? "text-red-600" : "text-neutral-700"}`}>{p.due}</span>
                </div>
              </div>

              {p.risk && (
                <div className="mt-3 flex gap-2 items-start text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="shrink-0">⚠️</span>
                  <span className="text-amber-800">{p.risk}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Gap callout */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
        <div className="text-sm font-bold text-red-800 mb-2">🔥 Gap: Forge Has No Stakeholder View</div>
        <p className="text-sm text-red-700 leading-relaxed">
          Non-technical stakeholders (executives, clients, investors) can't use Forge. There's no summary view, no PDF export, no RAG status. When a founder needs to brief an investor on product progress they have to manually build a slide deck from data scattered across Forge.
          <br /><br />
          <strong>Asana</strong> leads here with Portfolios + PDF export. <strong>Monday.com</strong> has embeddable dashboards. Forge should build a "Portfolio Summary" view that non-technical stakeholders can access with a share link (no account needed) — this is also a sales tool to land enterprise deals.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 7 — THINK TANK → PROJECT → ISSUE PROVENANCE CHAIN
// ══════════════════════════════════════════════════════════════

function ProvenanceShell() {
  const [expanded, setExpanded] = useState<string[]>(["tt", "proj"]);
  const toggle = (id: string) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="flex gap-4">
      {/* Chain visualization */}
      <div className="flex-1 max-w-[680px] space-y-3">
        <div className="text-sm text-neutral-600 mb-4 leading-relaxed">
          This is Forge's biggest competitive differentiator. Every ticket shows <em>why it exists</em> — tracing back through project decisions to the original idea. No competitor can do this. This is what "AI-native" actually means in a PM context.
        </div>

        {/* Think Tank Idea */}
        <div className="rounded-xl border-2 border-violet-200 overflow-hidden">
          <button onClick={() => toggle("tt")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-violet-50 hover:bg-violet-100 transition text-left">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white text-sm">💡</div>
            <div className="flex-1">
              <div className="text-xs font-bold text-violet-700 uppercase tracking-wide">Think Tank · Origin Idea</div>
              <div className="text-sm font-semibold text-violet-900">Security Hardening Initiative — Rate Limiting</div>
            </div>
            <div className="text-xs text-violet-500">{expanded.includes("tt") ? "▲" : "▼"}</div>
          </button>
          {expanded.includes("tt") && (
            <div className="px-4 py-4 bg-white border-t border-violet-100 space-y-3">
              <div className="text-sm text-neutral-700 leading-relaxed">
                <strong>Idea:</strong> "Our rate limiter is in-memory and resets on every deploy. In a multi-pod production environment this is security theater — a determined attacker can hit different pods to bypass the limit."
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="font-semibold text-neutral-600 mb-1">Submitted by</div>
                  <div className="flex items-center gap-2"><Av id="u1" size="xs" /> Matt Giblin · 3 weeks ago</div>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <div className="font-semibold text-neutral-600 mb-1">Votes</div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-indigo-600">4</span>
                    <span className="text-neutral-500">team members agreed</span>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-emerald-700 mb-1">✅ Signed off by</div>
                <div className="flex items-center gap-2 text-xs text-emerald-800">
                  <Av id="u1" size="xs" /> Matt Giblin · 14 days ago · "Approve — this is a production risk, prioritize above new features"
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Connector */}
        <div className="flex items-center gap-3 px-6">
          <div className="w-px h-6 bg-neutral-200 ml-3" />
          <div className="text-xs text-neutral-400">Promoted to project</div>
        </div>

        {/* Project */}
        <div className="rounded-xl border-2 border-indigo-200 overflow-hidden">
          <button onClick={() => toggle("proj")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-left">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm">📋</div>
            <div className="flex-1">
              <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Project · Sprint 6 Scope</div>
              <div className="text-sm font-semibold text-indigo-900">Security Hardening Sprint</div>
            </div>
            <div className="text-xs text-indigo-500">{expanded.includes("proj") ? "▲" : "▼"}</div>
          </button>
          {expanded.includes("proj") && (
            <div className="px-4 py-4 bg-white border-t border-indigo-100 space-y-3">
              <div className="text-sm text-neutral-700 leading-relaxed">
                A focused sprint to close all known security gaps before the public beta. Scope was reviewed and approved in a PM + founder sync on June 7.
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-600">Decisions made in this project:</div>
                {[
                  { text: "Rate limiter must survive pod restarts — use Upstash Redis", by: "u1" },
                  { text: "IMPERSONATION_SECRET will be required (not optional) — ENV validation on startup", by: "u4" },
                  { text: "IP extraction must work behind all major reverse proxy configs (Nginx, Cloudflare)", by: "u1" },
                ].map((d, i) => (
                  <div key={i} className="flex gap-2 items-start bg-indigo-50 rounded-lg px-3 py-2">
                    <span className="text-indigo-500 shrink-0 mt-0.5">💡</span>
                    <div className="flex-1 text-xs text-indigo-900">{d.text}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Av id={d.by} size="xs" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Connector */}
        <div className="flex items-center gap-3 px-6">
          <div className="w-px h-6 bg-neutral-200 ml-3" />
          <div className="text-xs text-neutral-400">Decomposed into issues</div>
        </div>

        {/* Issues */}
        <div className="rounded-xl border-2 border-sky-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-sky-50">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white text-sm">🎯</div>
            <div>
              <div className="text-xs font-bold text-sky-700 uppercase tracking-wide">Issues · Created from this project</div>
              <div className="text-sm font-semibold text-sky-900">3 issues in Sprint 6</div>
            </div>
          </div>
          <div className="bg-white border-t border-sky-100 divide-y divide-neutral-50">
            {[
              { key: "FORGE-45", title: "Migrate rate limiter to Redis/Upstash",     status: "blocked",     assignee: "u1" },
              { key: "INFRA-15", title: "Provision Upstash Redis + wire env vars",    status: "in_progress", assignee: "u2" },
              { key: "FORGE-52", title: "Make IMPERSONATION_SECRET mandatory",        status: "in_progress", assignee: "u1" },
            ].map(i => (
              <div key={i.key} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition cursor-pointer">
                <span className="text-xs text-neutral-400 font-mono w-[80px] shrink-0">{i.key}</span>
                <div className="flex-1 text-sm text-neutral-800 truncate">{i.title}</div>
                <Av id={i.assignee} size="xs" />
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  i.status === "blocked" ? "bg-red-500" : i.status === "in_progress" ? "bg-indigo-500" : "bg-emerald-500"
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Forge advantage callout */}
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="text-sm font-bold text-emerald-800 mb-2">✅ Forge Advantage: This Doesn't Exist Anywhere Else</div>
          <p className="text-sm text-emerald-700 leading-relaxed">
            In Linear, Jira, Asana, Monday, GitHub — when you look at an issue, you see: a title, description, comments. You do NOT see why the issue was created, what decision led to it, who signed off, what trade-offs were considered. That context lives in Slack messages, Confluence pages, Notion docs, or someone's memory.
            <br /><br />
            <strong>Forge's Think Tank → Project → Issue provenance chain is genuinely unique.</strong> It's the feature that should be in every sales demo and the headline of every marketing page.
          </p>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-[280px] shrink-0 space-y-4">
        <Card className="p-4">
          <SectionLabel>Where this lives in competitors</SectionLabel>
          <div className="space-y-3">
            {[
              { tool: "Linear",  where: "Nowhere. Issues have no parent context beyond project.", color: "text-red-600" },
              { tool: "Jira",    where: "Epic → Story → Subtask hierarchy but no 'why' layer.", color: "text-amber-600" },
              { tool: "Asana",   where: "Goals → Projects → Tasks but goals are often disconnected.", color: "text-amber-600" },
              { tool: "Notion",  where: "Closest: linked pages. But totally manual, no formal model.", color: "text-amber-600" },
              { tool: "Forge",   where: "Think Tank idea → sign-off → project → issues. Full chain.", color: "text-emerald-700" },
            ].map(r => (
              <div key={r.tool} className="text-xs">
                <div className="font-semibold text-neutral-700 mb-0.5">{r.tool}</div>
                <div className={r.color}>{r.where}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL 8 — GAP ANALYSIS (full competitive matrix)
// ══════════════════════════════════════════════════════════════

function GapAnalysisShell() {
  const gaps = [
    {
      category: "Navigation & Speed",
      severity: "critical",
      gaps: [
        { feature: "Command palette (⌘K)", linear: "✅ Best in class", jira: "✅ Exists", forge: "❌ Missing", priority: "P0" },
        { feature: "Keyboard shortcut system", linear: "✅ Full shortcuts", jira: "⚠️ Limited", forge: "❌ Missing", priority: "P0" },
        { feature: "Global search", linear: "✅ Instant search", jira: "✅ JQL search", forge: "❌ Missing", priority: "P0" },
      ]
    },
    {
      category: "Collaboration & Comments",
      severity: "high",
      gaps: [
        { feature: "Decision post type", linear: "❌ Missing", jira: "❌ Missing", forge: "❌ Missing — but we can own this", priority: "P0" },
        { feature: "Watch / Subscribe to issue", linear: "✅ Subscribers", jira: "✅ Watchers", forge: "❌ Missing", priority: "P0" },
        { feature: "Emoji reactions on comments", linear: "✅ Native", jira: "✅ Native", forge: "❌ Missing", priority: "P1" },
        { feature: "@mentions with notification", linear: "✅ Works great", jira: "✅ Works", forge: "⚠️ Partial, no notification", priority: "P0" },
      ]
    },
    {
      category: "Notifications",
      severity: "critical",
      gaps: [
        { feature: "Notification center / bell", linear: "✅ Inbox model", jira: "✅ Notification center", forge: "❌ Missing", priority: "P0" },
        { feature: "Email notifications", linear: "✅ Configurable", jira: "✅ Full config", forge: "❌ Missing", priority: "P0" },
        { feature: "Notification categories", linear: "✅ Grouped", jira: "⚠️ Noisy", forge: "❌ Missing", priority: "P1" },
        { feature: "Daily digest / AI summary", linear: "✅ Pulse (2025)", jira: "❌ Missing", forge: "❌ Missing", priority: "P1" },
      ]
    },
    {
      category: "Onboarding & First Run",
      severity: "high",
      gaps: [
        { feature: "New workspace member wizard", linear: "⚠️ Minimal", jira: "✅ Templates", forge: "❌ Missing", priority: "P1" },
        { feature: "Suggested first issue", linear: "❌ Missing", jira: "❌ Missing", forge: "❌ Missing — opportunity", priority: "P1" },
        { feature: "Team intro on join", linear: "❌ Missing", jira: "✅ Team directory", forge: "❌ Missing", priority: "P2" },
      ]
    },
    {
      category: "PM & Planning",
      severity: "high",
      gaps: [
        { feature: "Roadmap / timeline view", linear: "✅ Roadmaps", jira: "✅ Plans", forge: "❌ Missing — biggest PM gap", priority: "P0" },
        { feature: "Milestones", linear: "✅ Milestones", jira: "✅ Milestones", forge: "❌ Missing", priority: "P1" },
        { feature: "Sprint retrospective / close", linear: "⚠️ Basic", jira: "✅ Full retro", forge: "❌ Missing", priority: "P1" },
        { feature: "Capacity / load view", linear: "⚠️ Member workload", jira: "✅ Capacity planning", forge: "❌ Missing", priority: "P2" },
      ]
    },
    {
      category: "Stakeholder Access",
      severity: "medium",
      gaps: [
        { feature: "Executive / non-tech view", linear: "❌ Missing", jira: "✅ Dashboards", forge: "❌ Missing", priority: "P1" },
        { feature: "Portfolio / cross-project summary", linear: "⚠️ Limited", jira: "✅ Advanced Roadmaps", forge: "❌ Missing", priority: "P1" },
        { feature: "PDF / export for leadership", linear: "❌ Missing", jira: "✅ Reports", forge: "❌ Missing", priority: "P2" },
      ]
    },
    {
      category: "Forge Unique Advantages",
      severity: "advantage",
      gaps: [
        { feature: "Think Tank idea → issue provenance", linear: "❌ Missing", jira: "❌ Missing", forge: "✅ Only Forge has this", priority: "Differentiator" },
        { feature: "Decision posts (proposed)", linear: "❌ Missing", jira: "❌ Missing", forge: "🔧 Build this", priority: "Own it" },
        { feature: "Grok AI context-awareness", linear: "⚠️ GPT-4 integration", jira: "⚠️ Atlassian AI", forge: "✅ Grok native", priority: "Advantage" },
      ]
    },
  ];

  const severityBg: Record<string, string> = {
    critical:  "bg-red-50 border-red-200",
    high:      "bg-amber-50 border-amber-200",
    medium:    "bg-sky-50 border-sky-200",
    advantage: "bg-emerald-50 border-emerald-200",
  };
  const severityLabel: Record<string, string> = {
    critical: "🔥 Critical",
    high: "⚡ High",
    medium: "⚠️ Medium",
    advantage: "✅ Advantage",
  };
  const priorityColor: Record<string, string> = {
    P0: "bg-red-100 text-red-700 border-red-200",
    P1: "bg-amber-100 text-amber-700 border-amber-200",
    P2: "bg-sky-100 text-sky-700 border-sky-200",
    "Differentiator": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Own it": "bg-violet-100 text-violet-700 border-violet-200",
    "Advantage": "bg-indigo-100 text-indigo-700 border-indigo-200",
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-700 rounded-xl p-5 text-white">
        <div className="text-lg font-bold mb-1">Forge vs. Competition — Gap Analysis</div>
        <div className="text-sm text-neutral-300">Research-backed. Based on real user reviews, G2, Reddit, Hacker News, and Linear/Jira changelogs through June 2026.</div>
        <div className="flex gap-4 mt-3">
          <div className="text-center"><div className="text-2xl font-bold text-red-400">11</div><div className="text-xs text-neutral-400">P0 gaps</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-amber-400">9</div><div className="text-xs text-neutral-400">P1 gaps</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-emerald-400">3</div><div className="text-xs text-neutral-400">unique advantages</div></div>
        </div>
      </div>

      {gaps.map(section => (
        <div key={section.category} className={`rounded-xl border p-4 ${severityBg[section.severity]}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-neutral-800">{section.category}</div>
            <div className="text-xs font-semibold text-neutral-500">{severityLabel[section.severity]}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-500 border-b border-neutral-200">
                  <th className="text-left py-1.5 pr-4 font-semibold">Feature</th>
                  <th className="text-left py-1.5 pr-4 font-semibold">Linear</th>
                  <th className="text-left py-1.5 pr-4 font-semibold">Jira</th>
                  <th className="text-left py-1.5 pr-4 font-semibold">Forge</th>
                  <th className="text-left py-1.5 font-semibold">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {section.gaps.map(g => (
                  <tr key={g.feature} className="hover:bg-white/50 transition">
                    <td className="py-2 pr-4 font-medium text-neutral-800">{g.feature}</td>
                    <td className="py-2 pr-4 text-neutral-600">{g.linear}</td>
                    <td className="py-2 pr-4 text-neutral-600">{g.jira}</td>
                    <td className="py-2 pr-4 font-semibold">{g.forge}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${priorityColor[g.priority] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                        {g.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════

type WFView = "morning"|"collab"|"notifications"|"commandpalette"|"onboarding"|"stakeholder"|"provenance"|"gaps";

export default function WorkflowDesignPage() {
  const [view, setView] = useState<WFView>("morning");

  const views: { id: WFView; label: string; emoji: string; desc: string }[] = [
    { id: "morning",        label: "Morning Ritual",     emoji: "🌅", desc: "How developers start their day" },
    { id: "collab",         label: "Collaboration",      emoji: "🤝", desc: "Comments · Decisions · @mentions" },
    { id: "notifications",  label: "Notifications",      emoji: "🔔", desc: "Signal vs. noise · Inbox model" },
    { id: "commandpalette", label: "Command Palette",    emoji: "⌨️", desc: "Keyboard-first navigation" },
    { id: "onboarding",     label: "Onboarding",         emoji: "🎯", desc: "New member joining mid-flight" },
    { id: "stakeholder",    label: "Stakeholder View",   emoji: "📊", desc: "Executive · Non-technical summary" },
    { id: "provenance",     label: "Why It Exists",      emoji: "🔗", desc: "Think Tank → Project → Issue chain" },
    { id: "gaps",           label: "Gap Analysis",       emoji: "🔥", desc: "Full competitive matrix" },
  ];

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Top nav */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 mr-2">
            <Link href="/design" className="text-sm text-neutral-500 hover:text-neutral-900 transition font-medium">← Role Views</Link>
            <span className="text-neutral-200">|</span>
            <div>
              <p className="text-sm font-bold text-neutral-900">Forge UX & Workflow Flows</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Deep research · Competitive analysis · Clickable prototypes</p>
            </div>
          </div>
          <div className="flex gap-1.5 flex-1 overflow-x-auto">
            {views.map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition border whitespace-nowrap ${
                  view === v.id
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
                }`}>
                <span>{v.emoji}</span>{v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-indigo-600 text-white px-6 py-1.5 text-xs flex items-center gap-4">
          <span className="font-semibold">Research-backed:</span>
          <span>Linear · Jira · Asana · Monday.com · GitHub Issues · Shortcut · ClickUp · Notion — all reviewed for UX patterns and gaps</span>
          <span className="ml-auto opacity-70">{views.find(v => v.id === view)?.desc}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {view === "morning"        && <MorningRitualShell />}
        {view === "collab"         && <CollaborationShell />}
        {view === "notifications"  && <NotificationShell />}
        {view === "commandpalette" && <CommandPaletteShell />}
        {view === "onboarding"     && <OnboardingShell />}
        {view === "stakeholder"    && <StakeholderShell />}
        {view === "provenance"     && <ProvenanceShell />}
        {view === "gaps"           && <GapAnalysisShell />}
      </div>
    </div>
  );
}
