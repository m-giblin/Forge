"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { SpaceData, PageMeta } from "./page";

const RichEditor = dynamic(() => import("@/components/spaces/RichEditor"), { ssr: false });

type FullPage = PageMeta & { body: string };

export default function SpaceViewClient({
  slug, userId, canEdit, space, initialPages, initialPageId,
}: {
  slug: string;
  userId: string;
  role: string;
  canEdit: boolean;
  space: SpaceData;
  initialPages: PageMeta[];
  initialPageId?: string;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<PageMeta[]>(initialPages);
  const [activePage, setActivePage] = useState<FullPage | null>(null);
  // Load initial page if deep-linked
  const initialLoadDone = useRef(false);
  const [loading, setLoading] = useState(false);
  const [isPending, start] = useTransition();
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ id: string; allowed_domain: string } | null>(null);
  const [shareDomain, setShareDomain] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const bodyRef = useRef<string>("");

  async function loadPage(pageId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/spaces/pages/${pageId}?slug=${slug}`);
      const json = await res.json();
      if (json.data) {
        setActivePage(json.data);
        bodyRef.current = json.data.body ?? "";
      }
    } finally { setLoading(false); }
  }

  async function savePage() {
    if (!activePage) return;
    await fetch(`/api/spaces/pages/${activePage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, pageBody: bodyRef.current }),
    });
  }

  async function updateTitle(title: string) {
    if (!activePage) return;
    await fetch(`/api/spaces/pages/${activePage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, title }),
    });
    setPages((prev) => prev.map((p) => p.id === activePage.id ? { ...p, title } : p));
    setActivePage((prev) => prev ? { ...prev, title } : prev);
  }

  function createPage(parentId?: string) {
    start(async () => {
      const res = await fetch("/api/spaces/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, spaceId: space.id, parentId, title: "Untitled" }),
      });
      const json = await res.json();
      if (json.data) {
        setPages((prev) => [...prev, json.data]);
        await loadPage(json.data.id);
      }
    });
  }

  async function archivePage(pageId: string) {
    await fetch(`/api/spaces/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, status: "archived" }),
    });
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    if (activePage?.id === pageId) setActivePage(null);
  }

  async function handleShare() {
    if (!activePage) return;
    setShareError(null);
    const res = await fetch("/api/spaces/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, pageId: activePage.id, allowedDomain: shareDomain }),
    });
    const json = await res.json();
    if (json.error) { setShareError(json.error); return; }
    setShareResult(json.data);
  }

  async function revokeShare() {
    if (!shareResult) return;
    await fetch(`/api/spaces/share?slug=${slug}&shareId=${shareResult.id}`, { method: "DELETE" });
    setShareResult(null);
    setSharing(false);
  }

  const handleBodyChange = useCallback((content: string) => {
    bodyRef.current = content;
  }, []);

  // Auto-load deep-linked page on mount
  useState(() => {
    if (initialPageId && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadPage(initialPageId);
    }
  });

  // Build page tree
  const roots = pages.filter((p) => !p.parent_id);
  const children = (parentId: string) => pages.filter((p) => p.parent_id === parentId);

  return (
    <div className="flex h-full min-h-0 bg-white">
      {/* Sidebar */}
      <aside className="flex h-full w-56 shrink-0 flex-col border-r border-neutral-100 bg-neutral-50 overflow-y-auto">
        {/* Space header */}
        <div className="flex items-center gap-2.5 border-b border-neutral-100 px-3 py-3 shrink-0">
          <Link href={`/${slug}/spaces`} className="text-neutral-400 hover:text-neutral-700 transition text-sm">←</Link>
          <span className="text-lg">{space.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900 truncate">{space.name}</p>
            <p className="text-[10px] text-neutral-400 capitalize">{space.type} space</p>
          </div>
        </div>

        {/* Add page button — top of nav, not buried at the bottom */}
        {canEdit && (
          <div className="shrink-0 px-2 pt-2 pb-1">
            <button
              onClick={() => createPage()}
              disabled={isPending}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition"
            >
              <span className="text-base leading-none">+</span>
              <span>New page</span>
            </button>
          </div>
        )}

        {/* Pages tree */}
        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {roots.map((page) => (
            <PageTreeItem
              key={page.id}
              page={page}
              children={children(page.id)}
              active={activePage?.id === page.id}
              canEdit={canEdit}
              onSelect={loadPage}
              onArchive={archivePage}
              onAddChild={(pid) => createPage(pid)}
              activePageId={activePage?.id}
            />
          ))}

          {roots.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-neutral-400">No pages yet</p>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {!activePage && !loading && (
          <div className="flex flex-1 items-center justify-center flex-col gap-4 text-neutral-400">
            <span className="text-5xl">{space.icon}</span>
            <p className="text-lg font-medium text-neutral-600">{space.name}</p>
            <p className="text-sm">{space.description || "Select a page or create one to get started."}</p>
            {canEdit && (
              <button
                onClick={() => createPage()}
                className="mt-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 transition"
              >
                + Create first page
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          </div>
        )}

        {activePage && !loading && (
          <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
            {/* Page header */}
            <div className="flex items-center gap-3 px-8 pt-8 pb-2 shrink-0">
              <span className="text-3xl">{activePage.icon ?? "📄"}</span>
              {canEdit ? (
                <input
                  className="flex-1 text-2xl font-bold text-neutral-900 bg-transparent border-none outline-none placeholder-neutral-300 min-w-0"
                  value={activePage.title}
                  onChange={(e) => setActivePage((p) => p ? { ...p, title: e.target.value } : p)}
                  onBlur={(e) => updateTitle(e.target.value)}
                  placeholder="Untitled"
                />
              ) : (
                <h1 className="text-2xl font-bold text-neutral-900">{activePage.title}</h1>
              )}

              <div className="ml-auto flex items-center gap-2 shrink-0">
                {canEdit && (
                  <button
                    onClick={() => setSharing(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition"
                  >
                    🔗 Share
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => archivePage(activePage.id)}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-400 hover:border-red-200 hover:text-red-500 transition"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>

            <p className="px-8 text-[11px] text-neutral-400 mb-4">
              Last updated {new Date(activePage.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>

            {/* Rich editor */}
            <div className="flex-1 px-6 pb-16 min-w-0">
              <div className="mx-auto max-w-3xl rounded-xl border border-neutral-100 bg-white shadow-sm overflow-hidden">
                <RichEditor
                  content={activePage.body}
                  onChange={handleBodyChange}
                  onSave={savePage}
                  readOnly={!canEdit}
                  placeholder="Start writing… type / to insert a block"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share modal */}
      {sharing && activePage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900">Share Page (Read-Only)</h2>
              <button onClick={() => { setSharing(false); setShareError(null); }} className="text-neutral-400 hover:text-neutral-700">✕</button>
            </div>

            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold mb-1">🔐 Security notice</p>
              <p>Guests must verify their company email address to access this page. Access is read-only and expires after 48 hours. You can revoke access at any time.</p>
            </div>

            {!shareResult ? (
              <>
                <label className="mb-1 block text-xs font-medium text-neutral-700">
                  Restrict to email domain
                </label>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-neutral-400 text-sm">@</span>
                    <input
                      value={shareDomain}
                      onChange={(e) => setShareDomain(e.target.value.replace(/^@/, ""))}
                      placeholder="acme.com"
                      className="w-full rounded-xl border border-neutral-300 pl-8 pr-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleShare}
                    disabled={!shareDomain.trim()}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 transition"
                  >
                    Enable
                  </button>
                </div>
                {shareError && <p className="text-sm text-red-600 mt-1">{shareError}</p>}
                <p className="text-xs text-neutral-400 mt-2">
                  Only @{shareDomain || "yourdomain.com"} email addresses can request access. Generic providers (Gmail, Yahoo, etc.) are blocked.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-800 mb-1">✓ Sharing active</p>
                  <p className="text-sm text-emerald-700">
                    Anyone with a <strong>@{shareResult.allowed_domain}</strong> email can request a magic link to view this page.
                  </p>
                </div>
                <p className="text-xs text-neutral-500">
                  Share this page URL with your guests. They&apos;ll be prompted to verify their email before viewing.
                </p>
                <button
                  onClick={revokeShare}
                  className="w-full rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                >
                  Revoke access
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PageTreeItem({
  page, children, active, canEdit, onSelect, onArchive, onAddChild, activePageId,
}: {
  page: PageMeta;
  children: PageMeta[];
  active: boolean;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onAddChild: (parentId: string) => void;
  activePageId?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition ${active ? "bg-indigo-50 text-indigo-700" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded((e) => !e)} className="text-[10px] w-4 shrink-0 text-center text-neutral-400">
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="text-sm shrink-0">{page.icon ?? "📄"}</span>
        <button onClick={() => onSelect(page.id)} className="flex-1 min-w-0 text-left text-sm truncate font-medium">
          {page.title}
        </button>
        {canEdit && hovered && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(page.id); }}
              title="Add sub-page"
              className="h-5 w-5 flex items-center justify-center rounded text-[11px] hover:bg-neutral-200 text-neutral-400"
            >+</button>
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(page.id); }}
              title="Archive page"
              className="h-5 w-5 flex items-center justify-center rounded text-[11px] hover:bg-red-100 text-neutral-400 hover:text-red-500"
            >✕</button>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="ml-4 pl-2 border-l border-neutral-200 space-y-0.5 mt-0.5">
          {children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              children={[]}
              active={child.id === activePageId}
              canEdit={canEdit}
              onSelect={onSelect}
              onArchive={onArchive}
              onAddChild={onAddChild}
              activePageId={activePageId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
