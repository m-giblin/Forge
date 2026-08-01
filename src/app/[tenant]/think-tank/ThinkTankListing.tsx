"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import type { IdeaSummary } from "@/lib/repositories/ideas";
import { toggleVoteAction } from "./actions";
import ImpactEffortMatrix from "./ImpactEffortMatrix";
import CompetitorImportModal from "./CompetitorImportModal";
import PageHeader from "@/components/patterns/PageHeader";
import { FilterRow } from "@/components/patterns/FilterRow";
import Toggle from "@/components/patterns/Toggle";

const STATUS_META: Record<string, { label: string; fg: string; bg: string }> = {
  new:         { label: "New",         fg: "#a19d90", bg: "#f1efe9" },
  researching: { label: "Researching", fg: "#3a6ea8", bg: "#eaf1f8" },
  maturing:    { label: "Maturing",    fg: "#c9791d", bg: "#fdf1de" },
  ready:       { label: "Ready",       fg: "#3f7d4c", bg: "#e9f3ea" },
  converted:   { label: "Converted",   fg: "#7a4fa0", bg: "#f4ecfa" },
  archived:    { label: "Archived",    fg: "#a19d90", bg: "#f1efe9" },
};

const ALL_STATUSES = Object.keys(STATUS_META);

interface Props {
  slug: string;
  thinkTankId: string;
  ideas: IdeaSummary[];
  allTags: string[];
  members: Array<{ id: string; name: string | null; email: string }>;
  canCreate: boolean;
  blindVoting?: boolean;
  isAdmin?: boolean;
}

type SortMode = "recent" | "votes";
type ViewMode = "list" | "matrix";

export default function ThinkTankListing({ slug, thinkTankId, ideas: initialIdeas, allTags, members, canCreate, blindVoting = false, isAdmin = false }: Props) {
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
    <main className="flex h-[calc(100vh-56px)] flex-col overflow-hidden md:h-screen">
      <PageHeader
        title="Think Tank"
        subtitle="Capture and mature ideas — from rough concept to project"
        right={
          <>
            {hasIdeas && (
              <div className="flex gap-[5px] rounded-md bg-[#e3ded0] p-[3px]">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`rounded px-[11px] py-[5px] text-[11px] font-bold transition-colors ${
                    viewMode === "list" ? "bg-[#8c4632] text-[#e5e0d1]" : "text-[#4a473e]"
                  }`}
                >
                  ☰ List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("matrix")}
                  className={`rounded px-[11px] py-[5px] text-[11px] font-bold transition-colors ${
                    viewMode === "matrix" ? "bg-[#8c4632] text-[#e5e0d1]" : "text-[#4a473e]"
                  }`}
                >
                  ⊞ Matrix
                </button>
              </div>
            )}
            {canCreate && <CompetitorImportModal slug={slug} thinkTankId={thinkTankId} />}
            {canCreate && (
              <Link
                href={`/${slug}/think-tank/new`}
                className="rounded-[5px] border border-[#5e2c1f] px-[13px] py-[7px] text-[12px] font-bold text-[#f2e9d8]"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                + New idea
              </Link>
            )}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px] pb-7">
        {/* Blind voting banner */}
        {blindVoting && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-[#ddd8c9] bg-[#fdf1de] px-4 py-3 text-[12.5px] text-[#c9791d]">
            <span className="text-lg">🔒</span>
            <div>
              <span className="font-bold">Blind voting is active.</span>
              {isAdmin
                ? " Vote counts are visible to admins only. Disable in Admin → Think Tank settings."
                : " Vote counts are hidden until voting closes. You can still vote — your vote is recorded."}
            </div>
          </div>
        )}

        {/* Onboarding / empty state */}
        {!hasIdeas ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eae6da] text-3xl">
              💡
            </div>
            <h2 className="text-[15px] font-bold text-[#20201d]">No ideas yet</h2>
            <p className="mt-2 max-w-sm text-[12.5px] text-[#726e60]">
              Think Tank is where ideas grow. Create an idea, discuss it with your team, let the AI Sounding Board challenge or sharpen it, then convert the best ones into projects.
            </p>
            <div className="mt-4 flex items-center gap-6 text-[11px] text-[#a19d90]">
              <span className="flex items-center gap-1">💡 Create idea</span>
              <span className="text-[#c3bda9]">→</span>
              <span className="flex items-center gap-1">💬 Discuss</span>
              <span className="text-[#c3bda9]">→</span>
              <span className="flex items-center gap-1">🤖 AI review</span>
              <span className="text-[#c3bda9]">→</span>
              <span className="flex items-center gap-1">📋 Convert to project</span>
            </div>
            {canCreate && (
              <Link
                href={`/${slug}/think-tank/new`}
                className="mt-6 rounded-[5px] border border-[#5e2c1f] px-5 py-2.5 text-[12.5px] font-bold text-[#f2e9d8]"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
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
            <FilterRow>
              <input
                type="search"
                placeholder="Search ideas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-56 shrink-0 rounded-md border border-[#ddd8c9] bg-[#f4f2eb] px-3 text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 shrink-0 rounded-md border border-[#ddd8c9] bg-[#f4f2eb] px-2 text-[12.5px] text-[#4a473e] outline-none focus:border-[#b7452f]"
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
                  className="h-9 shrink-0 rounded-md border border-[#ddd8c9] bg-[#f4f2eb] px-2 text-[12.5px] text-[#4a473e] outline-none focus:border-[#b7452f]"
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
                  className="h-9 shrink-0 rounded-md border border-[#ddd8c9] bg-[#f4f2eb] px-2 text-[12.5px] text-[#4a473e] outline-none focus:border-[#b7452f]"
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
                className="h-9 shrink-0 rounded-md border border-[#ddd8c9] bg-[#f4f2eb] px-2 text-[12.5px] text-[#4a473e] outline-none focus:border-[#b7452f]"
              >
                <option value="recent">Sort: Recent</option>
                {!blindVoting && <option value="votes">Sort: Most voted</option>}
              </select>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12.5px] text-[#726e60]">
                <Toggle on={showArchived} onChange={setShowArchived} />
                Show archived
              </label>
            </FilterRow>

            {/* Results count */}
            {(debouncedSearch || filterStatus || filterTag || filterAssignee) && (
              <p className="mb-3 mt-3 text-[11px] text-[#a19d90]">
                {filtered.length} of {ideas.length} ideas
              </p>
            )}

            {/* Idea cards */}
            {filtered.length === 0 ? (
              <div className="mt-12 text-center text-[12.5px] text-[#a19d90]">
                No ideas match your filters.
              </div>
            ) : (
              <div className={`flex flex-col gap-2.5 ${(debouncedSearch || filterStatus || filterTag || filterAssignee) ? "" : "mt-4"}`}>
                {filtered.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    slug={slug}
                    query={debouncedSearch}
                    onVote={() => handleVoteToggle(idea.id)}
                    blindVoting={blindVoting}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function IdeaCard({
  idea,
  slug,
  query,
  onVote,
  blindVoting,
  isAdmin,
}: {
  idea: IdeaSummary;
  slug: string;
  query: string;
  onVote: () => void;
  blindVoting: boolean;
  isAdmin: boolean;
}) {
  const meta = STATUS_META[idea.status] ?? STATUS_META.new;
  const lastActivity = formatRelative(idea.updated_at);
  const [pending, startTransition] = useTransition();

  function handleVoteClick(e: React.MouseEvent) {
    e.preventDefault();
    startTransition(() => { onVote(); });
  }

  return (
    <div className="fw-card flex items-stretch gap-0 overflow-hidden">
      {/* Vote button */}
      <button
        onClick={handleVoteClick}
        disabled={pending}
        title={idea.user_has_voted ? "Remove vote" : "Vote for this idea"}
        className={`flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-[#e3ded0] px-2 py-3 text-[11px] font-bold transition disabled:opacity-50 ${
          idea.user_has_voted ? "text-[#8c4632]" : "text-[#a19d90] hover:bg-[#eae6da] hover:text-[#4a473e]"
        }`}
      >
        <span className="text-base leading-none">▲</span>
        <span className="font-[family-name:var(--font-manrope)] text-[16px] font-extrabold text-[#20201d]">
          {blindVoting && !isAdmin ? "—" : idea.vote_count}
        </span>
      </button>

      {/* Card link */}
      <Link
        href={`/${slug}/think-tank/${idea.id}`}
        className="flex min-w-0 flex-1 items-start gap-4 px-4 py-3.5"
      >
        {/* Private lock */}
        <div className="mt-0.5 w-4 shrink-0 text-center text-[#c3bda9]">
          {idea.is_private && <span title="Private idea">🔒</span>}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13.5px] font-bold text-[#20201d]">
              <HighlightText text={idea.title} query={query} />
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ color: meta.fg, backgroundColor: meta.bg }}
            >
              {meta.label}
            </span>
          </div>

          {idea.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#eae6da] px-2 py-0.5 text-[11px] text-[#4a473e]"
                >
                  <HighlightText text={tag} query={query} />
                </span>
              ))}
            </div>
          )}
          <MaturityBar idea={idea} />
        </div>

        {/* Meta */}
        <div className="flex shrink-0 items-center gap-4 text-[11px] text-[#a19d90]">
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
          <mark key={i} className="rounded bg-[#fdf1de] px-0.5 text-[#c9791d]">{part}</mark>
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
  const color = pct >= 80 ? "#3f7d4c" : pct >= 40 ? "#c9791d" : "#ddd8c9";
  return (
    <div className="mt-1.5 flex items-center gap-2" title={hint}>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-[#e3ded0]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] text-[#a19d90]">{score}/{max}</span>
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
        className="rounded-full bg-[#fbeae8] px-1.5 py-0.5 font-semibold text-[#c0392b]"
      >
        {isToday ? "⚠ Today" : "⚠ Overdue"}
      </span>
    );
  }
  return (
    <span title={`Review by ${reviewBy}`} className="text-[#3a6ea8]">
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
