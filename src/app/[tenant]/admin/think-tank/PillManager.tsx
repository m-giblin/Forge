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

const EMPTY = { label: "", instruction: "" };

function Pill({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold"
      style={muted ? { color: "#4a473e", backgroundColor: "#f1efe9" } : { color: "#8c4632", backgroundColor: "#f3e4dd" }}
    >
      {children}
    </span>
  );
}

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
    <div className="space-y-5">
      {error && (
        <div className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</div>
      )}

      {/* Built-in lenses */}
      <div>
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Default AI lenses</span>
          <span className="rounded-full bg-[#e3ded0] px-2 py-0.5 text-[10.5px] font-semibold text-[#726e60]">{PILLS.length} lenses</span>
        </div>
        <div className="fw-card px-4 py-3.5">
          <p className="mb-3 text-[11px] text-[#726e60]">Built-in and always available to all teams. Cannot be edited or removed.</p>
          <div className="flex flex-wrap gap-2">
            {PILLS.map((p) => (
              <Pill key={p.id} muted>{p.label}</Pill>
            ))}
          </div>
        </div>
      </div>

      {/* Custom lenses */}
      <div>
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Custom lenses</span>
          {!readOnly && !showNew && (
            <button
              onClick={openNew}
              className="rounded-[5px] border border-[#5e2c1f] px-3 py-[6px] text-[11.5px] font-semibold text-[#f2e9d8]"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              + Add lens
            </button>
          )}
        </div>

        <div className="fw-card px-4 py-3.5">
          <p className="mb-3 text-[11px] text-[#726e60]">Your team&apos;s own AI analysis perspectives, added after the defaults.</p>

          {showNew && (
            <form
              onSubmit={editingId ? (e) => handleUpdate(editingId, e) : handleCreate}
              className="mb-4 rounded-[6px] border border-[#ddd8c9] bg-white p-4 space-y-3"
            >
              <p className="text-[12.5px] font-bold text-[#20201d]">{editingId ? "Edit lens" : "New AI lens"}</p>
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Label</label>
                <input
                  name="label"
                  required
                  maxLength={60}
                  defaultValue={form.label}
                  placeholder="e.g. Regulatory Risk"
                  autoFocus
                  className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">AI instruction</label>
                <textarea
                  name="instruction"
                  required
                  maxLength={1000}
                  rows={3}
                  defaultValue={form.instruction}
                  placeholder="e.g. Analyse this idea from a regulatory and compliance perspective. Identify relevant laws or standards that may apply..."
                  className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]"
                />
                <p className="mt-1 text-[11px] text-[#a19d90]">This is sent directly to the AI. Be specific about the perspective you want.</p>
              </div>
              {error && <p className="rounded-[6px] bg-[#fbeae8] px-3 py-2 text-[11.5px] text-[#c0392b]">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8]"
                  style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
                >
                  {editingId ? "Update lens" : "Create lens"}
                </button>
                <button type="button" onClick={cancel} className="rounded-[5px] px-3.5 py-[7px] text-[12px] font-semibold text-[#a19d90] hover:bg-[#eae6da]">Cancel</button>
              </div>
            </form>
          )}

          {pills.length === 0 && !showNew && (
            <div className="py-6 text-center">
              <p className="mb-2 text-[24px]">🔬</p>
              <p className="text-[12.5px] font-semibold text-[#20201d]">No custom lenses yet</p>
              <p className="mt-1 text-[11.5px] text-[#a19d90]">Add lenses to give your team specialized AI analysis perspectives.</p>
              {!readOnly && (
                <button onClick={openNew} className="mt-3 text-[11.5px] font-semibold text-[#b7452f] hover:underline">+ Add your first lens</button>
              )}
            </div>
          )}

          {pills.length > 0 && (
            <div className="space-y-2">
              {pills.map((pill) => (
                <div key={pill.id} className={`rounded-[6px] border p-3.5 ${editingId === pill.id ? "border-[#8c4632] bg-[#f3e4dd]" : "border-[#e3ded0] bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-0.5 shrink-0"><Pill>{pill.label}</Pill></span>
                      <p className="mt-1 text-[11.5px] text-[#726e60] line-clamp-2">{pill.instruction}</p>
                    </div>
                    {!readOnly && (
                      <div className="mt-1 flex shrink-0 gap-2.5">
                        <button onClick={() => openEdit(pill)} className="text-[11.5px] font-semibold text-[#726e60] hover:text-[#20201d]">Edit</button>
                        <button onClick={() => handleDelete(pill.id)} className="text-[11.5px] font-semibold text-[#c0392b] hover:underline">Delete</button>
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
