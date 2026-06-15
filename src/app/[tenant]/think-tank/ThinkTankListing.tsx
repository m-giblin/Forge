"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { IdeaSummary } from "@/lib/repositories/ideas";

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

export default function ThinkTankListing({ slug, ideas, allTags, members, canCreate }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return ideas.filter((idea) => {
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
  }, [ideas, debouncedSearch, filterStatus, filterTag, filterAssignee, showArchived]);

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
        {canCreate && (
          <Link
            href={`/${slug}/think-tank/new`}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + New Idea
          </Link>
        )}
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
                <IdeaCard key={idea.id} idea={idea} slug={slug} query={debouncedSearch} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IdeaCard({ idea, slug, query }: { idea: IdeaSummary; slug: string; query: string }) {
  const meta = STATUS_META[idea.status] ?? STATUS_META.new;
  const lastActivity = formatRelative(idea.updated_at);

  return (
    <Link
      href={`/${slug}/think-tank/${idea.id}`}
      className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-neutral-300 hover:shadow"
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
      </div>

      {/* Meta */}
      <div className="flex shrink-0 items-center gap-4 text-xs text-neutral-400">
        {idea.comment_count > 0 && (
          <span title="Comments">💬 {idea.comment_count}</span>
        )}
        {idea.assignee_name && (
          <span title="Assigned to">{idea.assignee_name}</span>
        )}
        <span title="Last activity">{lastActivity}</span>
      </div>
    </Link>
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
