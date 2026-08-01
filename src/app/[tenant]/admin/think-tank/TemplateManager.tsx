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
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Custom Idea Templates</span>
        {!readOnly && !showForm && (
          <button
            onClick={openNew}
            className="rounded-[5px] border border-[#5e2c1f] px-3 py-[6px] text-[11.5px] font-semibold text-[#f2e9d8]"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
          >
            + Add template
          </button>
        )}
      </div>

      <div className="fw-card px-4 py-3.5">
        <p className="mb-3 text-[11px] text-[#726e60]">Templates appear in the idea creation form alongside the built-in ones.</p>

        {showForm && (
          <div className="mb-4 rounded-[6px] border border-[#ddd8c9] bg-white p-4 space-y-3.5">
            <p className="text-[12.5px] font-bold text-[#20201d]">{editingId ? "Edit template" : "New idea template"}</p>

            <div>
              <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Template name</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Feature Request, Bug Report, Experiment…"
                autoFocus
                className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">
                Description template <span className="font-normal normal-case text-[#a19d90]">(pre-filled when selected)</span>
              </label>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={"## Problem\n\n## Proposed solution\n\n## Success looks like"}
                className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 font-mono text-[12px] outline-none focus:border-[#b7452f]"
              />
              <p className="mt-1 text-[11px] text-[#a19d90]">Markdown supported. Use ## headings to guide contributors.</p>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">
                Suggested AI lenses <span className="font-normal normal-case text-[#a19d90]">(shown as recommended when this template is used)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PILLS.map((pill) => {
                  const checked = form.suggestedPillIds.includes(pill.id);
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => togglePill(pill.id)}
                      className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                        checked
                          ? "border-[#8c4632] bg-[#8c4632] text-[#f2e9d8]"
                          : "border-[#ddd8c9] bg-white text-[#4a473e] hover:bg-[#eae6da]"
                      }`}
                    >
                      {checked ? "✓ " : ""}{pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="rounded-[6px] bg-[#fbeae8] px-3 py-2 text-[11.5px] text-[#c0392b]">{error}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={isPending || !form.label.trim()}
                className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                {isPending ? "Saving…" : editingId ? "Update template" : "Create template"}
              </button>
              <button onClick={cancelForm} className="rounded-[5px] px-3.5 py-[7px] text-[12px] font-semibold text-[#a19d90] hover:bg-[#eae6da]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {templates.length === 0 && !showForm && (
          <div className="py-8 text-center">
            <p className="mb-2 text-[24px]">📄</p>
            <p className="text-[12.5px] font-semibold text-[#20201d]">No custom templates yet</p>
            <p className="mx-auto mt-1 max-w-xs text-[11.5px] text-[#a19d90]">
              Templates give contributors a structured starting point — headings, prompts, and suggested AI lenses pre-configured.
            </p>
            {!readOnly && (
              <button
                onClick={openNew}
                className="mt-4 rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8]"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                + Create first template
              </button>
            )}
          </div>
        )}

        {templates.length > 0 && (
          <div className="space-y-2.5">
            {templates.map((t) => (
              <div key={t.id} className="overflow-hidden rounded-[6px] border border-[#e3ded0] bg-white">
                <div className="flex items-start justify-between gap-4 border-b border-[#e3ded0] bg-[#eae6da] px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px]">📋</span>
                    <p className="text-[12.5px] font-bold text-[#20201d]">{t.label}</p>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-2.5">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-[11.5px] font-semibold text-[#726e60] hover:text-[#20201d]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={isPending}
                        className="text-[11.5px] font-semibold text-[#c0392b] hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 px-3.5 py-3">
                  {t.description ? (
                    <p className="whitespace-pre-wrap font-mono text-[11px] text-[#726e60] line-clamp-2">{t.description}</p>
                  ) : (
                    <p className="text-[11.5px] italic text-[#a19d90]">No description template set</p>
                  )}
                  {t.suggestedPillIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="mr-1 self-center text-[10.5px] text-[#a19d90]">Suggested lenses:</span>
                      {t.suggestedPillIds.map((id) => {
                        const pill = PILLS.find((p) => p.id === id);
                        return pill ? (
                          <span key={id} className="rounded-full border border-[#e0c9bd] bg-[#f3e4dd] px-2 py-0.5 text-[10.5px] font-semibold text-[#8c4632]">
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
