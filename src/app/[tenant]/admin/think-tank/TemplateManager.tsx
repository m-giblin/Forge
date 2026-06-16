"use client";

import { useState, useTransition } from "react";
import { PILLS } from "@/lib/ai/pills";
import type { TenantIdeaTemplate } from "@/lib/repositories/ideas";
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
} from "./actions";

interface Props {
  slug: string;
  templates: TenantIdeaTemplate[];
  readOnly: boolean;
}

const EMPTY = { label: "", description: "", suggestedPillIds: [] as string[] };

export default function TemplateManager({ slug, templates, readOnly }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
    setShowForm(true);
  }

  function openEdit(t: TenantIdeaTemplate) {
    setEditingId(t.id);
    setForm({ label: t.label, description: t.description, suggestedPillIds: t.suggestedPillIds });
    setError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  function togglePill(id: string) {
    setForm((f) => ({
      ...f,
      suggestedPillIds: f.suggestedPillIds.includes(id)
        ? f.suggestedPillIds.filter((p) => p !== id)
        : [...f.suggestedPillIds, id],
    }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        if (editingId) {
          await updateTemplateAction(slug, editingId, form.label, form.description, form.suggestedPillIds);
        } else {
          await createTemplateAction(slug, form.label, form.description, form.suggestedPillIds);
        }
        cancelForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteTemplateAction(slug, id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Custom Idea Templates</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Templates appear in the idea creation form alongside the built-in ones.
          </p>
        </div>
        {!readOnly && !showForm && (
          <button
            onClick={openNew}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            + Add template
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h4 className="mb-3 text-sm font-medium text-neutral-900">
            {editingId ? "Edit template" : "New template"}
          </h4>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-neutral-700">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Feature Request"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-neutral-700">
              Description template
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Pre-filled description when this template is selected. Markdown supported."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-neutral-700">
              Suggested AI lenses
            </label>
            <div className="flex flex-wrap gap-2">
              {PILLS.map((pill) => {
                const checked = form.suggestedPillIds.includes(pill.id);
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => togglePill(pill.id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      checked
                        ? "bg-blue-600 text-white"
                        : "border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !form.label.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {isPending ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button
              onClick={cancelForm}
              className="text-xs text-neutral-500 hover:text-neutral-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm && (
        <p className="rounded-xl border border-dashed border-neutral-200 py-6 text-center text-sm text-neutral-400">
          No custom templates yet.{" "}
          {!readOnly && (
            <button onClick={openNew} className="text-blue-600 hover:underline">
              Add one
            </button>
          )}
        </p>
      )}

      {templates.length > 0 && (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">{t.label}</p>
                {t.description && (
                  <p className="mt-0.5 truncate text-xs text-neutral-400">{t.description}</p>
                )}
                {t.suggestedPillIds.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.suggestedPillIds.map((id) => {
                      const pill = PILLS.find((p) => p.id === id);
                      return pill ? (
                        <span key={id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                          {pill.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              {!readOnly && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => openEdit(t)}
                    className="text-xs text-neutral-500 hover:text-neutral-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
