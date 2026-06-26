"use client";

import { useState, useTransition } from "react";
import { createOkrAction, updateOkrAction, deleteOkrAction } from "./actions";

type Okr = {
  id: string; title: string; description: string | null; quarter: string | null;
  status: string; progress: number; created_at: string; owner_id: string | null;
  users: { email: string } | null;
};

interface Props {
  slug: string;
  initialOkrs: Okr[];
  tenantId: string;
  isAdmin: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  draft:    "bg-neutral-50 text-neutral-600 border-neutral-200",
  active:   "bg-blue-50 text-blue-700 border-blue-200",
  achieved: "bg-green-50 text-green-700 border-green-200",
  missed:   "bg-red-50 text-red-700 border-red-200",
};

const EMPTY = { title: "", description: "", quarter: "", status: "active", progress: 0 };
const QUARTERS = ["Q1 2026","Q2 2026","Q3 2026","Q4 2026","Q1 2027","Q2 2027","Q3 2027","Q4 2027"];

export default function OkrManager({ slug, initialOkrs, isAdmin }: Props) {
  const [okrs, setOkrs] = useState<Okr[]>(initialOkrs);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
    setShowForm(true);
  }

  function openEdit(o: Okr) {
    setEditingId(o.id);
    setForm({ title: o.title, description: o.description ?? "", quarter: o.quarter ?? "", status: o.status, progress: o.progress });
    setError(null);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        if (editingId) {
          await updateOkrAction(slug, editingId, form);
          setOkrs((prev) => prev.map((o) => o.id === editingId ? { ...o, ...form, users: o.users } : o));
        } else {
          await createOkrAction(slug, form);
          setOkrs((prev) => [{ id: crypto.randomUUID(), ...form, description: form.description || null, quarter: form.quarter || null, created_at: new Date().toISOString(), owner_id: null, users: null }, ...prev]);
        }
        cancel();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this OKR? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteOkrAction(slug, id);
        setOkrs((prev) => prev.filter((o) => o.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete.");
      }
    });
  }

  const active = okrs.filter((o) => o.status === "active");
  const others = okrs.filter((o) => o.status !== "active");

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Inline form */}
      {showForm && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 space-y-4">
          <p className="text-sm font-semibold text-indigo-900">{editingId ? "Edit OKR" : "New Objective"}</p>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Objective <span className="text-red-500">*</span></label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Grow enterprise customer base by 40%"
              autoFocus
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Key results / notes</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="KR1: ...\nKR2: ..."
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Quarter</label>
              <select
                value={form.quarter}
                onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">— none —</option>
                {QUARTERS.map((q) => <option key={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                {["draft","active","achieved","missed"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Progress %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((f) => ({ ...f, progress: Math.min(100, Math.max(0, +e.target.value)) }))}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !form.title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : editingId ? "Update" : "Create OKR"}
            </button>
            <button onClick={cancel} className="text-xs text-neutral-500 hover:text-neutral-700 px-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Active OKRs */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">Active Objectives</p>
          {isAdmin && !showForm && (
            <button onClick={openNew} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              + Add OKR
            </button>
          )}
        </div>

        {active.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-sm font-medium text-neutral-700">No active OKRs</p>
            <p className="text-xs text-neutral-400 mt-1">Create your first objective to track strategic alignment.</p>
            {isAdmin && !showForm && (
              <button onClick={openNew} className="mt-4 text-xs text-indigo-600 hover:underline">+ Create first OKR</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {active.map((o) => <OkrRow key={o.id} okr={o} isAdmin={isAdmin} onEdit={openEdit} onDelete={handleDelete} />)}
          </div>
        )}
      </div>

      {/* Past OKRs */}
      {others.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50">
            <p className="text-sm font-semibold text-neutral-900">Past Objectives</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {others.map((o) => <OkrRow key={o.id} okr={o} isAdmin={isAdmin} onEdit={openEdit} onDelete={handleDelete} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function OkrRow({ okr, isAdmin, onEdit, onDelete }: { okr: Okr; isAdmin: boolean; onEdit: (o: Okr) => void; onDelete: (id: string) => void }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-neutral-900">{okr.title}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[okr.status] ?? ""}`}>
              {okr.status}
            </span>
            {okr.quarter && <span className="text-[10px] text-neutral-400 font-mono">{okr.quarter}</span>}
          </div>
          {okr.description && <p className="text-xs text-neutral-500 whitespace-pre-wrap line-clamp-2">{okr.description}</p>}
          {/* Progress bar */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${okr.progress >= 100 ? "bg-green-500" : okr.progress >= 50 ? "bg-indigo-500" : "bg-orange-400"}`}
                style={{ width: `${okr.progress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-neutral-500 shrink-0">{okr.progress}%</span>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0 mt-0.5">
            <button onClick={() => onEdit(okr)} className="text-xs text-neutral-400 hover:text-neutral-700">Edit</button>
            <button onClick={() => onDelete(okr.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
