"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpaceRow } from "./page";

type RecentPage = { id: string; space_id: string; title: string; icon: string | null; updated_at: string };

export default function SpacesHubClient({
  slug, userId, role, spaces, recentPages,
}: {
  slug: string;
  userId: string;
  role: string;
  spaces: SpaceRow[];
  recentPages: RecentPage[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState<"team" | "personal" | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📚");
  const [isPending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; space_id: string; title: string; icon: string | null; spaces: { name: string } | null }[]>([]);
  const [searching, setSearching] = useState(false);

  const canEdit = role === "owner" || role === "admin" || role === "member";
  const isOwnerAdmin = role === "owner" || role === "admin";

  const projectSpaces = spaces.filter((s) => s.type === "project");
  const teamSpaces = spaces.filter((s) => s.type === "team");
  const personalSpaces = spaces.filter((s) => s.type === "personal" && s.owner_id === userId);

  const ICONS_TEAM = ["📚","🏢","⚙️","🚀","📋","🔧","💡","🎯","📊","🛡️"];
  const ICONS_PERSONAL = ["🧠","📝","💭","🌟","🎨","🔬","📖","🗂️","✍️","🔍"];

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/spaces/pages/search?slug=${slug}&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setSearchResults(json.data ?? []);
    } finally { setSearching(false); }
  }

  async function createSpace() {
    if (!newName.trim() || !creating) return;
    start(async () => {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, type: creating, name: newName.trim(), icon: newIcon }),
      });
      const json = await res.json();
      if (json.data) {
        setCreating(null);
        setNewName("");
        router.push(`/${slug}/spaces/${json.data.id}`);
      }
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-neutral-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Spaces</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Docs that live next to your work — and don&apos;t rot.</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCreating("team"); setNewIcon("📚"); }}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 transition"
            >
              + Team Space
            </button>
            <button
              onClick={() => { setCreating("personal"); setNewIcon("🧠"); }}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
            >
              + My Space
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
        {/* Search */}
        <div className="relative max-w-md">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search all pages…"
            className="w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-4 py-2 text-sm placeholder-neutral-400 shadow-sm focus:border-neutral-400 focus:outline-none"
          />
          <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">🔍</span>
          {search.length >= 2 && (
            <div className="absolute top-full mt-1 z-20 w-full rounded-xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
              {searching && <p className="px-4 py-3 text-sm text-neutral-400">Searching…</p>}
              {!searching && searchResults.length === 0 && (
                <p className="px-4 py-3 text-sm text-neutral-400">No results for &ldquo;{search}&rdquo;</p>
              )}
              {searchResults.map((p) => (
                <Link
                  key={p.id}
                  href={`/${slug}/spaces/${p.space_id}/${p.id}`}
                  onClick={() => { setSearch(""); setSearchResults([]); }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                >
                  <span>{p.icon ?? "📄"}</span>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{p.title}</p>
                    <p className="text-xs text-neutral-400">{p.spaces?.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent pages */}
        {recentPages.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Recently Updated</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {recentPages.map((p) => (
                <Link
                  key={p.id}
                  href={`/${slug}/spaces/${p.space_id}/${p.id}`}
                  className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm transition group"
                >
                  <span className="text-lg shrink-0">{p.icon ?? "📄"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-indigo-700">{p.title}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {new Date(p.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Project Spaces */}
        <SpaceSection title="Project Spaces" icon="📁" empty="No project spaces yet. Create a project to get one automatically.">
          {projectSpaces.map((s) => (
            <SpaceCard key={s.id} space={s} slug={slug} />
          ))}
        </SpaceSection>

        {/* Team Spaces */}
        <SpaceSection title="Team Spaces" icon="🏢" empty="No team spaces yet.">
          {teamSpaces.map((s) => (
            <SpaceCard key={s.id} space={s} slug={slug} canDelete={isOwnerAdmin} onDeleted={(id) => router.refresh()} />
          ))}
        </SpaceSection>

        {/* My Space */}
        <SpaceSection title="My Space" icon="🧠" empty="Create a personal space to keep private notes, drafts, and ideas.">
          {personalSpaces.map((s) => (
            <SpaceCard key={s.id} space={s} slug={slug} canDelete userId={userId} onDeleted={(id) => router.refresh()} />
          ))}
        </SpaceSection>
      </div>

      {/* Create space modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-semibold text-neutral-900">
              New {creating === "team" ? "Team" : "Personal"} Space
            </h2>
            <p className="mb-5 text-sm text-neutral-500">
              {creating === "team"
                ? "Shared with your whole team — runbooks, how-tos, onboarding docs."
                : "Private to you — personal notes, drafts, research."}
            </p>

            {/* Icon picker */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-neutral-600">Icon</p>
              <div className="flex flex-wrap gap-1.5">
                {(creating === "team" ? ICONS_TEAM : ICONS_PERSONAL).map((e) => (
                  <button
                    key={e}
                    onClick={() => setNewIcon(e)}
                    className={`h-9 w-9 rounded-lg text-lg transition ${newIcon === e ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-neutral-100"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSpace()}
              placeholder={creating === "team" ? "e.g. Engineering Runbooks" : "e.g. My Research"}
              className="mb-5 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <div className="flex gap-3">
              <button
                onClick={createSpace}
                disabled={!newName.trim() || isPending}
                className="flex-1 rounded-xl bg-neutral-900 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 transition"
              >
                {isPending ? "Creating…" : "Create Space"}
              </button>
              <button
                onClick={() => { setCreating(null); setNewName(""); }}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpaceSection({ title, icon, children, empty }: { title: string; icon: string; children: React.ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        <span>{icon}</span>{title}
      </h2>
      {hasChildren ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-200 py-5 text-center text-sm text-neutral-400">{empty}</p>
      )}
    </section>
  );
}

function SpaceCard({ space, slug, canDelete, userId: _userId, onDeleted }: {
  space: SpaceRow;
  slug: string;
  canDelete?: boolean;
  userId?: string;
  onDeleted?: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    const res = await fetch(`/api/spaces?slug=${slug}&id=${space.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(space.id);
    else setDeleting(false);
  }

  return (
    <div className="group relative">
      <Link
        href={`/${slug}/spaces/${space.id}`}
        className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"
      >
        <span className="mt-0.5 text-2xl shrink-0">{space.icon}</span>
        <div className="min-w-0">
          <p className="font-medium text-neutral-800 group-hover:text-indigo-700 transition truncate">{space.name}</p>
          {space.description && (
            <p className="mt-0.5 text-xs text-neutral-400 line-clamp-2">{space.description}</p>
          )}
          {space.type === "project" && space.projects && (
            <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
              {space.projects.key}
            </span>
          )}
          {space.type === "personal" && (
            <span className="mt-1 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
              Private
            </span>
          )}
          {space.type === "team" && (
            <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
              Team
            </span>
          )}
        </div>
      </Link>
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          onBlur={() => setConfirm(false)}
          className={`absolute right-2 top-2 rounded-md px-2 py-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
            confirm
              ? "bg-red-600 text-white"
              : "bg-neutral-100 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          }`}
        >
          {deleting ? "…" : confirm ? "Confirm?" : "Delete"}
        </button>
      )}
    </div>
  );
}
