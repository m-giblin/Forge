"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Whiteboard {
  id: string;
  name: string;
  thumbnail: string | null;
  updated_at: string;
}

interface Props {
  slug: string;
  projectId: string;
  projectKey: string;
  canEdit: boolean;
}

export default function WhiteboardsPanel({ slug, projectId, projectKey, canEdit }: Props) {
  const router = useRouter();
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, startCreate] = useTransition();
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const base = `/api/projects/${projectId}/whiteboards?slug=${slug}`;

  useEffect(() => {
    fetch(base)
      .then((r) => r.json())
      .then((j) => setBoards(j.data ?? []))
      .catch(() => setBoards([]))
      .finally(() => setLoading(false));
  }, [base]);

  function createBoard() {
    const name = newName.trim() || "Whiteboard";
    startCreate(async () => {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const j = await res.json();
        router.push(`/${slug}/projects/${projectKey}/whiteboards/${j.data.id}`);
      }
    });
  }

  async function deleteBoard(id: string) {
    setDeleteId(id);
    const res = await fetch(`/api/projects/${projectId}/whiteboards/${id}?slug=${slug}`, { method: "DELETE" });
    if (res.ok) setBoards((prev) => prev.filter((b) => b.id !== id));
    setDeleteId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
        Loading whiteboards…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Whiteboards</h3>
          <p className="text-xs text-neutral-500">Visual brainstorming and diagramming for your team</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          >
            + New whiteboard
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBoard()}
            placeholder="Whiteboard name…"
            className="flex-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
          <button
            onClick={createBoard}
            disabled={creating}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
          <button onClick={() => setShowCreate(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
            Cancel
          </button>
        </div>
      )}

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-14 text-center">
          <div className="mb-2 text-3xl">🎨</div>
          <p className="text-sm font-medium text-neutral-600">No whiteboards yet</p>
          <p className="mt-1 text-xs text-neutral-400">Create a whiteboard to brainstorm, diagram, or map ideas visually.</p>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Create first whiteboard
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <div key={board.id} className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md hover:border-neutral-300">
              {/* Preview area */}
              <Link href={`/${slug}/projects/${projectKey}/whiteboards/${board.id}`}>
                <div className="relative flex h-36 items-center justify-center overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #f8f9ff 0%, #eef0f8 100%)" }}>
                  {/* Dot-grid background pattern */}
                  <svg className="absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id={`dots-${board.id}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill="#94a3b8" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#dots-${board.id})`} />
                  </svg>
                  {board.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={board.thumbnail} alt="" className="relative h-full w-full object-contain" />
                  ) : (
                    /* Decorative mini-shapes suggesting a real whiteboard */
                    <svg className="relative h-24 w-32" viewBox="0 0 128 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Sticky note 1 */}
                      <rect x="4" y="12" width="36" height="32" rx="3" fill="#fef08a" stroke="#fbbf24" strokeWidth="1"/>
                      <line x1="10" y1="22" x2="34" y2="22" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="10" y1="28" x2="30" y2="28" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="10" y1="34" x2="26" y2="34" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
                      {/* Sticky note 2 */}
                      <rect x="46" y="8" width="36" height="32" rx="3" fill="#bbf7d0" stroke="#34d399" strokeWidth="1"/>
                      <line x1="52" y1="18" x2="76" y2="18" stroke="#065f46" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="52" y1="24" x2="72" y2="24" stroke="#065f46" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="52" y1="30" x2="68" y2="30" stroke="#065f46" strokeWidth="1.5" strokeLinecap="round"/>
                      {/* Sticky note 3 */}
                      <rect x="88" y="14" width="36" height="32" rx="3" fill="#ddd6fe" stroke="#a78bfa" strokeWidth="1"/>
                      <line x1="94" y1="24" x2="118" y2="24" stroke="#4c1d95" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="94" y1="30" x2="114" y2="30" stroke="#4c1d95" strokeWidth="1.5" strokeLinecap="round"/>
                      {/* Connecting arrow */}
                      <path d="M40 28 C42 28 44 28 46 28" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#arrow)"/>
                      <path d="M82 24 C85 24 87 24 88 24" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
                      <polygon points="86,21 90,24 86,27" fill="#94a3b8"/>
                      {/* Frame outline */}
                      <rect x="4" y="58" width="120" height="28" rx="4" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
                      <text x="14" y="77" fontSize="8" fill="#94a3b8" fontFamily="sans-serif">Whiteboard</text>
                    </svg>
                  )}
                  {/* Board type badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/80 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-neutral-500 shadow-sm border border-neutral-200/60">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h7a1 1 0 110 2H4a1 1 0 01-1-1z"/>
                    </svg>
                    Whiteboard
                  </div>
                </div>
              </Link>
              {/* Footer */}
              <div className="flex items-center justify-between px-3 py-2.5 border-t border-neutral-100">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate max-w-[160px]">{board.name}</p>
                  <p className="text-xs text-neutral-400">
                    Updated {new Date(board.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/${slug}/projects/${projectKey}/whiteboards/${board.id}`}
                    className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700 transition"
                  >
                    Open
                  </Link>
                  {canEdit && (
                    <button
                      onClick={() => deleteBoard(board.id)}
                      disabled={deleteId === board.id}
                      className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition"
                    >
                      {deleteId === board.id ? "…" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
