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

const PILL_COLORS = [
  "bg-red-50 text-red-700 border-red-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-yellow-50 text-yellow-700 border-yellow-200",
  "bg-green-50 text-green-700 border-green-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-purple-50 text-purple-700 border-purple-200",
];

const EMPTY = { label: "", instruction: "" };

export default function PillManager({ slug, pills, readOnly }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openNew() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
    setShowNew(true);
  }

  function openEdit(pill: CustomPillRow) {
    setEditingId(pill.id);
    setForm({ label: pill.label, instruction: pill.instruction });
    setError(null);
    setShowNew(true);
  }

  function cancel() {
    setShowNew(false);
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createPillAction(slug, data);
        cancel();
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
        cancel();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update.");
      }
    });
  }

  function handleDelete(pillId: string) {
    if (!confirm("Delete this lens? This cannot be undone.")) return;
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
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {/* Built-in lenses */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Default AI lenses</p>
            <p className="text-xs text-neutral-500 mt-0.5">Built-in and always available to all teams. Cannot be edited or removed.</p>
          </div>
          <span className="text-xs text-neutral-400 bg-neutral-100 rounded-full px-2.5 py-1">{PILLS.length} lenses</span>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {PILLS.map((p, i) => (
            <span
              key={p.id}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${PILL_COLORS[i % PILL_COLORS.length]}`}
              title={p.instruction}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Custom lenses */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Custom lenses</p>
            <p className="text-xs text-neutral-500 mt-0.5">Your team&apos;s own AI analysis perspectives, added after the defaults.</p>
          </div>
          {!readOnly && !showNew && (
            <button
              onClick={openNew}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              + Add lens
            </button>
          )}
        </div>

        <div className="px-5 py-4">
          {/* Form */}
          {showNew && (
            <form
              onSubmit={editingId ? (e) => handleUpdate(editingId, e) : handleCreate}
              className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3"
            >
              <p className="text-sm font-semibold text-indigo-900">{editingId ? "Edit lens" : "New AI lens"}</p>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Label <span className="text-red-500">*</span></label>
                <input
                  name="label"
                  required
                  maxLength={60}
                  defaultValue={form.label}
                  placeholder="e.g. Regulatory Risk"
                  autoFocus
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">AI instruction <span className="text-red-500">*</span></label>
                <textarea
                  name="instruction"
                  required
                  maxLength={1000}
                  rows={3}
                  defaultValue={form.instruction}
                  placeholder="e.g. Analyse this idea from a regulatory and compliance perspective. Identify relevant laws or standards that may apply..."
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
                <p className="text-[10px] text-neutral-400 mt-1">This is sent directly to the AI. Be specific about the perspective you want.</p>
              </div>
              {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                  {editingId ? "Update lens" : "Create lens"}
                </button>
                <button type="button" onClick={cancel} className="text-xs text-neutral-500 hover:text-neutral-700 px-2">Cancel</button>
              </div>
            </form>
          )}

          {pills.length === 0 && !showNew && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🔬</p>
              <p className="text-sm font-medium text-neutral-700">No custom lenses yet</p>
              <p className="text-xs text-neutral-500 mt-1">Add lenses to give your team specialized AI analysis perspectives.</p>
              {!readOnly && (
                <button onClick={openNew} className="mt-3 text-xs text-indigo-600 hover:underline">+ Add your first lens</button>
              )}
            </div>
          )}

          {pills.length > 0 && (
            <div className="space-y-2">
              {pills.map((pill, i) => (
                <div key={pill.id} className={`rounded-xl border p-4 ${editingId === pill.id ? "border-indigo-200 bg-indigo-50" : "border-neutral-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium mt-0.5 ${PILL_COLORS[(PILLS.length + i) % PILL_COLORS.length]}`}>
                        {pill.label}
                      </span>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-1">{pill.instruction}</p>
                    </div>
                    {!readOnly && (
                      <div className="flex shrink-0 gap-2 mt-1">
                        <button onClick={() => openEdit(pill)} className="text-xs text-neutral-400 hover:text-neutral-700">Edit</button>
                        <button onClick={() => handleDelete(pill.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
