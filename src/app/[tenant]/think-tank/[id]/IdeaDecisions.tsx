"use client";

import { useState, useTransition } from "react";
import { addDecisionAction, deleteDecisionAction } from "../actions";
import type { IdeaDecision } from "@/lib/repositories/ideas";

interface Props {
  slug: string;
  ideaId: string;
  decisions: IdeaDecision[];
  isAdmin: boolean;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function IdeaDecisions({ slug, ideaId, decisions, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addDecisionAction(slug, ideaId, title, body);
        setTitle("");
        setBody("");
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record decision.");
      }
    });
  }

  function handleDelete(decisionId: string, decisionTitle: string) {
    if (!confirm(`Remove decision "${decisionTitle}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteDecisionAction(slug, ideaId, decisionId);
    });
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Decisions</h3>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            + Record decision
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Decision title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Approved for Q3 roadmap"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Notes <span className="text-neutral-400">(optional)</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Context, conditions, or rationale…"
                rows={3}
                className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={isPending || !title.trim()}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Record decision"}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null); setTitle(""); setBody(""); }}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {decisions.length === 0 && !showForm ? (
        <p className="text-sm text-neutral-400">No decisions recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {decisions.map((d) => (
            <div key={d.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-base">✅</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{d.title}</p>
                  {d.body && <p className="mt-1 text-sm text-neutral-600">{d.body}</p>}
                  <p className="mt-1.5 text-xs text-neutral-400">
                    {d.decidedByName ? `${d.decidedByName} · ` : ""}{fmtDate(d.createdAt)}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(d.id, d.title)}
                    disabled={isPending}
                    className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
