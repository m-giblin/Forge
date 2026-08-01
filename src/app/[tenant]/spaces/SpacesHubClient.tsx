"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpaceRow, RecentPageRow } from "./page";
import PageHeader from "@/components/patterns/PageHeader";
import AdminList from "@/components/patterns/admin/AdminList";
import { timeAgo } from "@/lib/formatRelativeTime";

type RecentPage = RecentPageRow;

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

  const allSpacesForList = [...projectSpaces, ...teamSpaces, ...personalSpaces];

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--fw-cream-bg)]">
      <PageHeader
        title="Spaces"
        subtitle="Team wiki — specs, runbooks and decisions"
        right={
          canEdit ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCreating("team"); setNewIcon("📚"); }}
                className="rounded-[5px] bg-[#b7452f] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#8c4632] transition"
              >
                + Team Space
              </button>
              <button
                onClick={() => { setCreating("personal"); setNewIcon("🧠"); }}
                className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#ede9db] transition"
              >
                + My Space
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
        {/* Search */}
        <div className="relative max-w-md">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search all pages…"
            className="w-full rounded-xl border border-[#ddd8c9] bg-white pl-9 pr-4 py-2 text-[12.5px] placeholder-[#a19d90] shadow-sm focus:border-[#b7452f]/50 focus:outline-none"
          />
          <span className="absolute left-3 top-2.5 text-[#a19d90] text-sm">🔍</span>
          {search.length >= 2 && (
            <div className="absolute top-full mt-1 z-20 w-full rounded-xl border border-[#ddd8c9] bg-white shadow-xl overflow-hidden">
              {searching && <p className="px-4 py-3 text-[12.5px] text-[#a19d90]">Searching…</p>}
              {!searching && searchResults.length === 0 && (
                <p className="px-4 py-3 text-[12.5px] text-[#a19d90]">No results for &ldquo;{search}&rdquo;</p>
              )}
              {searchResults.map((p) => (
                <Link
                  key={p.id}
                  href={`/${slug}/spaces/${p.space_id}/${p.id}`}
                  onClick={() => { setSearch(""); setSearchResults([]); }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f4f2eb] border-b border-[#e3ded0] last:border-0"
                >
                  <span>{p.icon ?? "📄"}</span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#20201d]">{p.title}</p>
                    <p className="text-[11px] text-[#a19d90]">{p.spaces?.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* All spaces */}
        <section>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Spaces</h2>
          {allSpacesForList.length > 0 ? (
            <AdminList
              items={allSpacesForList.map((s) => ({
                key: s.id,
                title: `${s.icon} ${s.name}`,
                subline: s.description ?? spaceTypeLabel(s),
                meta: `${spaceTypeLabel(s)}`,
                actionLabel: "Open",
                onAction: () => router.push(`/${slug}/spaces/${s.id}`),
              }))}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-[#ddd8c9] py-5 text-center text-[12.5px] text-[#a19d90]">
              No spaces yet. Create a team or personal space to get started.
            </p>
          )}
        </section>

        {/* Recently edited */}
        {recentPages.length > 0 && (
          <section>
            <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Recently edited</h2>
            <AdminList
              items={recentPages.map((p) => ({
                key: p.id,
                title: `${p.icon ?? "📄"} ${p.title}`,
                subline: [p.spaces?.name, p.updated_by_user?.name ?? p.updated_by_user?.email].filter(Boolean).join(" · "),
                meta: timeAgo(p.updated_at),
                actionLabel: "Open",
                onAction: () => router.push(`/${slug}/spaces/${p.space_id}/${p.id}`),
              }))}
            />
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
                    className={`h-9 w-9 rounded-lg text-lg transition ${newIcon === e ? "bg-[#f4e3dc] ring-2 ring-[#b7452f]" : "hover:bg-neutral-100"}`}
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
                className="flex-1 rounded-xl border border-[#5e2c1f] py-2.5 text-sm font-semibold text-[#f2e9d8] disabled:opacity-50 transition"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
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

function spaceTypeLabel(s: SpaceRow): string {
  if (s.type === "project") return s.projects ? `Project · ${s.projects.key}` : "Project";
  if (s.type === "personal") return "Private";
  return "Team";
}

function SpaceSection({ title, icon, children, empty }: { title: string; icon: string; children: React.ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[12.5px] font-bold text-[#20201d]">
        <span>{icon}</span>{title}
      </h2>
      {hasChildren ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#ddd8c9] py-5 text-center text-[12.5px] text-[#a19d90]">{empty}</p>
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
        className="fw-card flex items-start gap-3 p-4 transition hover:border-[#b7452f]/40 hover:shadow-sm"
      >
        <span className="mt-0.5 text-2xl shrink-0">{space.icon}</span>
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-manrope)] text-[13px] font-bold text-[#20201d] group-hover:text-[#b7452f] transition truncate">{space.name}</p>
          {space.description && (
            <p className="mt-0.5 text-[11.5px] text-[#726e60] line-clamp-2">{space.description}</p>
          )}
          <span className="mt-1 inline-block rounded-full bg-[#f4f2eb] px-2 py-0.5 text-[10.5px] font-semibold text-[#8c4632]">
            {spaceTypeLabel(space)}
          </span>
        </div>
      </Link>
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          onBlur={() => setConfirm(false)}
          className={`absolute right-2 top-2 rounded-md px-2 py-1 text-[10.5px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${
            confirm
              ? "bg-red-600 text-white"
              : "bg-[#f4f2eb] text-[#a19d90] hover:bg-red-50 hover:text-red-600"
          }`}
        >
          {deleting ? "…" : confirm ? "Confirm?" : "Delete"}
        </button>
      )}
    </div>
  );
}
