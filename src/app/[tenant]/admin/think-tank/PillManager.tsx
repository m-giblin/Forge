"use client";

import { useState, useTransition } from "react";
import { createPillAction, updatePillAction, deletePillAction } from "./actions";
import type { CustomPillRow } from "@/lib/repositories/ideas";
import { PILLS } from "@/lib/ai/pills";

interface Props {
  slug: string;
  pills: CustomPillRow[];
  readOnly: boolean;
}

export default function PillManager({ slug, pills, readOnly }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createPillAction(slug, data);
        setShowNew(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create.");
      }
    });
  }

  function handleUpdate(pillId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updatePillAction(slug, pillId, data);
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update.");
      }
    });
  }

  function handleDelete(pillId: string) {
    if (!confirm("Delete this pill? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePillAction(slug, pillId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Default pills (read-only display) */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-700">Default lenses</h3>
        <p className="mb-3 text-xs text-neutral-400">Built-in and always available. Cannot be edited or removed.</p>
        <div className="flex flex-wrap gap-2">
          {PILLS.map((p) => (
            <span
              key={p.id}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-500"
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Custom pills */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-700">Custom lenses</h3>
          {!readOnly && !showNew && (
            <button
              onClick={() => setShowNew(true)}
              className="rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
            >
              + Add lens
            </button>
          )}
        </div>

        {pills.length === 0 && !showNew && (
          <p className="text-sm text-neutral-400 italic">No custom lenses yet.</p>
        )}

        {/* New pill form */}
        {showNew && (
          <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Label (shown on button)</label>
              <input
                name="label"
                required
                maxLength={60}
                placeholder="e.g. Regulatory Risk"
                autoFocus
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Instruction (sent to AI)</label>
              <textarea
                name="instruction"
                required
                maxLength={1000}
                rows={3}
                placeholder="e.g. Analyse this idea from a regulatory and compliance perspective. Identify relevant laws or standards that may apply..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">
                Save
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="text-xs text-neutral-500 hover:text-neutral-700">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Existing custom pills */}
        <div className="space-y-3">
          {pills.map((pill) => (
            <div key={pill.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              {editingId === pill.id ? (
                <form onSubmit={(e) => handleUpdate(pill.id, e)} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Label</label>
                    <input
                      name="label"
                      required
                      maxLength={60}
                      defaultValue={pill.label}
                      autoFocus
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Instruction</label>
                    <textarea
                      name="instruction"
                      required
                      maxLength={1000}
                      rows={3}
                      defaultValue={pill.instruction}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-neutral-500 hover:text-neutral-700">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{pill.label}</p>
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{pill.instruction}</p>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setEditingId(pill.id)}
                        className="text-xs text-neutral-400 hover:text-neutral-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(pill.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
