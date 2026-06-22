"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import type { IdeaSummary } from "@/lib/repositories/ideas";
import { toggleVoteAction } from "./actions";
import ImpactEffortMatrix from "./ImpactEffortMatrix";

const STATUS_META: Record<string, { label: string; color: string }> = {
  new:         { label: "New",         color: "bg-neutral-100 text-neutral-600" },
  researching: { label: "Researching", color: "bg-blue-100 text-blue-700" },
  maturing:    { label: "Maturing",    color: "bg-yellow-100 text-yellow-700" },
  ready:       { label: "Ready",       color: "bg-green-100 text-green-700" },
  converted:   { label: "Converted",   color: "bg-purple-100 text-purple-700" },
  archived:    { label: "Archived",    color: "bg-neutral-100 text-neutral-400" },
};

const ALL_STATUSES = Object.keys(STATUS_META);

interface Props {
  slug: string;
  thinkTankId: string;
  ideas: IdeaSummary[];
  allTags: string[];
  members: Array<{ id: string; name: string | null; email: string }>;
  canCreate: boolean;
}

type SortMode = "recent" | "votes";
type ViewMode = "list" | "matrix";

export default function ThinkTankListing({ slug, ideas: initialIdeas, allTags, members, canCreate }: Props) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    let list = ideas.filter((idea) => {
      if (!showArchived && idea.status === "archived") return false;
      if (filterStatus && idea.status !== filterStatus) return false;
      if (filterTag && !idea.tags.includes(filterTag)) return false;
      if (filterAssignee && idea.assigned_to !== filterAssignee) return false;
      if (q &&
        !idea.title.toLowerCase().includes(q) &&
        !(idea.description ?? "").toLowerCase().includes(q) &&
        !idea.tags.some((t) => t.toLowerCase().includes(q))
      ) return false;
      return true;
    });
    if (sortBy === "votes") {
      list = [...list].sort((a, b) => b.vote_count - a.vote_count);
    }
    return list;
  }, [ideas, debouncedSearch, filterStatus, filterTag, filterAssignee, showArchived, sortBy]);

  function handleVoteToggle(ideaId: string) {
    // Optimistic update
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === ideaId
          ? {
              ...idea,
              user_has_voted: !idea.user_has_voted,
              vote_count: idea.user_has_voted ? idea.vote_count - 1 : idea.vote_count + 1,
            }
          : idea
      )
    );
    // Fire and forget — server syncs in background
    toggleVoteAction(slug, ideaId).catch(() => {
      // Revert on error
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === ideaId
            ? {
                ...idea,
                user_has_voted: !idea.user_has_voted,
                vote_count: idea.user_has_voted ? idea.vote_count - 1 : idea.vote_count + 1,
              }
            : idea
        )
      );
    });
  }

  const hasIdeas = ideas.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Think Tank</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Capture and mature ideas — from rough concept to project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasIdeas && (
            <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-sm">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 font-medium transition-colors ${viewMode === "list" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("matrix")}
                className={`px-3 py-1.5 font-medium transition-colors ${viewMode === "matrix" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
              >
                ⊞ Matrix
              </button>
            </div>
          )}
          {canCreate && (
            <Link
              href={`/${slug}/think-tank/new`}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              + New Idea
            </Link>
          )}
        </div>
      </div>

      {/* Onboarding / empty state */}
      {!hasIdeas ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-3xl">
            💡
          </div>
          <h2 className="text-lg font-semibold text-neutral-800">No ideas yet</h2>
          <p className="mt-2 max-w-sm text-sm text-neutral-500">
            Think Tank is where ideas grow. Create an idea, discuss it with your team, let the AI Sounding Board challenge or sharpen it, then convert the best ones into projects.
          </p>
          <div className="mt-4 flex items-center gap-6 text-xs text-neutral-400">
            <span className="flex items-center gap-1">💡 Create idea</span>
            <span className="text-neutral-300">→</span>
            <span className="flex items-center gap-1">💬 Discuss</span>
            <span className="text-neutral-300">→</span>
            <span className="flex items-center gap-1">🤖 AI review</span>
            <span className="text-neutral-300">→</span>
            <span className="flex items-center gap-1">📋 Convert to project</span>
          </div>
          {canCreate && (
            <Link
              href={`/${slug}/think-tank/new`}
              className="mt-6 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Create your first idea
            </Link>
          )}
        </div>
      ) : viewMode === "matrix" ? (
        <ImpactEffortMatrix slug={slug} ideas={ideas} />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search ideas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 rounded-lg border border-neutral-200 px-2 text-sm text-neutral-600 outline-none focus:border-neutral-400"
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="h-9 rounded-lg border border-neutral-200 px-2 text-sm text-neutral-600 outline-none focus:border-neutral-400"
              >
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            {members.length > 1 && (
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="h-9 rounded-lg border border-neutral-200 px-2 text-sm text-neutral-600 outline-none focus:border-neutral-400"
              >
                <option value="">All assignees</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                ))}
              </select>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="h-9 rounded-lg border border-neutral-200 px-2 text-sm text-neutral-600 outline-none focus:border-neutral-400"
            >
              <option value="recent">Sort: Recent</option>
              <option value="votes">Sort: Most voted</option>
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-neutral-500">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Show archived
            </label>
          </div>

          {/* Results count */}
          {(debouncedSearch || filterStatus || filterTag || filterAssignee) && (
            <p className="mb-3 text-xs text-neutral-400">
              {filtered.length} of {ideas.length} ideas
            </p>
          )}

          {/* Idea cards */}
          {filtered.length === 0 ? (
            <div className="mt-12 text-center text-sm text-neutral-400">
              No ideas match your filters.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  slug={slug}
                  query={debouncedSearch}
                  onVote={() => handleVoteToggle(idea.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  slug,
  query,
  onVote,
}: {
  idea: IdeaSummary;
  slug: string;
  query: string;
  onVote: () => void;
}) {
  const meta = STATUS_META[idea.status] ?? STATUS_META.new;
  const lastActivity = formatRelative(idea.updated_at);
  const [pending, startTransition] = useTransition();

  function handleVoteClick(e: React.MouseEvent) {
    e.preventDefault();
    startTransition(() => { onVote(); });
  }

  return (
    <div className="flex items-stretch gap-0 rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-300 hover:shadow">
      {/* Vote button */}
      <button
        onClick={handleVoteClick}
        disabled={pending}
        title={idea.user_has_voted ? "Remove vote" : "Vote for this idea"}
        className={`flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-l-xl border-r border-neutral-100 px-2 py-3 text-xs font-medium transition disabled:opacity-50 ${
          idea.user_has_voted
            ? "bg-neutral-900 text-white"
            : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
        }`}
      >
        <span className="text-base leading-none">▲</span>
        <span>{idea.vote_count}</span>
      </button>

      {/* Card link */}
      <Link
        href={`/${slug}/think-tank/${idea.id}`}
        className="flex min-w-0 flex-1 items-start gap-4 px-4 py-3.5"
      >
        {/* Private lock */}
        <div className="mt-0.5 w-4 shrink-0 text-center text-neutral-300">
          {idea.is_private && <span title="Private idea">🔒</span>}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium text-neutral-900">
              <HighlightText text={idea.title} query={query} />
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
              {meta.label}
            </span>
          </div>

          {idea.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500"
                >
                  <HighlightText text={tag} query={query} />
                </span>
              ))}
            </div>
          )}
          <MaturityBar idea={idea} />
        </div>

        {/* Meta */}
        <div className="flex shrink-0 items-center gap-4 text-xs text-neutral-400">
          {idea.review_by && <ReviewDueChip reviewBy={idea.review_by} />}
          {idea.comment_count > 0 && (
            <span title="Comments">💬 {idea.comment_count}</span>
          )}
          {idea.assignee_name && (
            <span title="Assigned to">{idea.assignee_name}</span>
          )}
          <span title="Last activity">{lastActivity}</span>
        </div>
      </Link>
    </div>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded bg-yellow-100 px-0.5 text-yellow-900">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

const STATUS_SCORES: Record<string, number> = {
  new: 0, researching: 1, maturing: 2, ready: 3, converted: 3, archived: 0,
};

function maturityScore(idea: IdeaSummary): { score: number; max: number; hint: string } {
  let score = 0;
  const missing: string[] = [];
  if (idea.description && idea.description.trim().length > 20) score++;
  else missing.push("add a description");
  if (idea.comment_count > 0) score++;
  else missing.push("start a discussion");
  if (idea.ai_turn_count > 0) score++;
  else missing.push("run the AI Sounding Board");
  if (idea.assigned_to) score++;
  else missing.push("assign an owner");
  if (STATUS_SCORES[idea.status] >= 1) score++;
  else missing.push("advance the status");
  const hint = missing.length > 0 ? `Next: ${missing[0]}` : "Fully matured";
  return { score, max: 5, hint };
}

function MaturityBar({ idea }: { idea: IdeaSummary }) {
  if (idea.status === "archived" || idea.status === "converted") return null;
  const { score, max, hint } = maturityScore(idea);
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-neutral-300";
  return (
    <div className="mt-1.5 flex items-center gap-2" title={hint}>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-neutral-400">{score}/{max}</span>
    </div>
  );
}

function ReviewDueChip({ reviewBy }: { reviewBy: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = reviewBy < today;
  const isToday = reviewBy === today;
  if (isOverdue || isToday) {
    return (
      <span
        title={`Review due ${reviewBy}`}
        className="rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-700"
      >
        {isToday ? "⚠ Today" : "⚠ Overdue"}
      </span>
    );
  }
  return (
    <span title={`Review by ${reviewBy}`} className="text-blue-500">
      📅 {new Date(reviewBy + "T12:00:00").toLocaleDateString()}
    </span>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
