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
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Custom Idea Templates</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Templates appear in the idea creation form alongside the built-in ones.
          </p>
        </div>
        {!readOnly && !showForm && (
          <button
            onClick={openNew}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            + Add template
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {/* Inline form */}
        {showForm && (
          <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-5 space-y-4">
            <p className="text-sm font-semibold text-indigo-900">{editingId ? "Edit template" : "New idea template"}</p>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Template name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Feature Request, Bug Report, Experiment…"
                autoFocus
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Description template
                <span className="ml-1 text-neutral-400 font-normal">(pre-filled when selected)</span>
              </label>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={"## Problem\n\n## Proposed solution\n\n## Success looks like"}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
              <p className="text-[10px] text-neutral-400 mt-1">Markdown supported. Use ## headings to guide contributors.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-2">
                Suggested AI lenses
                <span className="ml-1 text-neutral-400 font-normal">(shown as recommended when this template is used)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PILLS.map((pill) => {
                  const checked = form.suggestedPillIds.includes(pill.id);
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => togglePill(pill.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        checked
                          ? "border-indigo-400 bg-indigo-600 text-white"
                          : "border-neutral-200 bg-white text-neutral-600 hover:border-indigo-300 hover:text-indigo-700"
                      }`}
                    >
                      {checked ? "✓ " : ""}{pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={isPending || !form.label.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving…" : editingId ? "Update template" : "Create template"}
              </button>
              <button onClick={cancelForm} className="text-xs text-neutral-500 hover:text-neutral-700 px-2">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {templates.length === 0 && !showForm && (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📄</p>
            <p className="text-sm font-medium text-neutral-700">No custom templates yet</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
              Templates give contributors a structured starting point — headings, prompts, and suggested AI lenses pre-configured.
            </p>
            {!readOnly && (
              <button
                onClick={openNew}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                + Create first template
              </button>
            )}
          </div>
        )}

        {/* Template list */}
        {templates.length > 0 && (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 transition-colors overflow-hidden">
                <div className="flex items-start justify-between gap-4 px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <p className="text-sm font-semibold text-neutral-900">{t.label}</p>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-xs text-neutral-500 hover:text-neutral-800 font-medium"
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
                </div>
                <div className="px-4 py-3 space-y-2">
                  {t.description ? (
                    <p className="text-xs text-neutral-500 line-clamp-2 font-mono whitespace-pre-wrap">{t.description}</p>
                  ) : (
                    <p className="text-xs text-neutral-400 italic">No description template set</p>
                  )}
                  {t.suggestedPillIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-neutral-400 mr-1 self-center">Suggested lenses:</span>
                      {t.suggestedPillIds.map((id) => {
                        const pill = PILLS.find((p) => p.id === id);
                        return pill ? (
                          <span key={id} className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] text-indigo-700 font-medium">
                            {pill.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
