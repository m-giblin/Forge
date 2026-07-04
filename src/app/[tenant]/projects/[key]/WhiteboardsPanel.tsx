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
                <div className="flex h-36 items-center justify-center bg-neutral-50">
                  {board.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={board.thumbnail} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <svg className="h-12 w-12 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M7 8h5m-5 4h8m-8 4h3" />
                    </svg>
                  )}
                </div>
              </Link>
              {/* Footer */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-neutral-900 truncate max-w-[160px]">{board.name}</p>
                  <p className="text-xs text-neutral-400">
                    {new Date(board.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/${slug}/projects/${projectKey}/whiteboards/${board.id}`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    Open
                  </Link>
                  {canEdit && (
                    <button
                      onClick={() => deleteBoard(board.id)}
                      disabled={deleteId === board.id}
                      className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
