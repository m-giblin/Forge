"use client";

import { useState, useTransition } from "react";
import { createOkrAction, updateOkrAction, deleteOkrAction } from "./actions";
import AdminList from "@/components/patterns/admin/AdminList";
import FormGrid from "@/components/patterns/admin/FormGrid";

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

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  draft: { fg: "#a19d90", bg: "#f1efe9" },
  active: { fg: "#3a6ea8", bg: "#eaf1f8" },
  achieved: { fg: "#3f7d4c", bg: "#e9f3ea" },
  missed: { fg: "#c0392b", bg: "#fbeae8" },
};

const EMPTY = { title: "", description: "", quarter: "", status: "active", progress: 0 };
const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027"];

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

  function okrBadge(o: Okr) {
    const c = STATUS_COLOR[o.status] ?? STATUS_COLOR.draft;
    return (
      <span className="rounded-full px-2 py-[3px] text-[10.5px] font-bold" style={{ color: c.fg, backgroundColor: c.bg }}>
        {o.status}
      </span>
    );
  }

  function okrItems(list: Okr[]) {
    return list.map((o) => ({
      key: o.id,
      title: (
        <span className="flex items-center gap-2">
          {o.title}
          {okrBadge(o)}
          {o.quarter && <span className="font-mono text-[10.5px] text-[#a19d90]">{o.quarter}</span>}
        </span>
      ),
      subline: (
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e3ded0]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${o.progress}%`, backgroundColor: o.progress >= 100 ? "#3f7d4c" : o.progress >= 50 ? "#3a6ea8" : "#c9791d" }}
            />
          </span>
          <span>{o.progress}%</span>
        </span>
      ),
      meta: isAdmin ? (
        <span className="flex items-center gap-2.5">
          <button onClick={() => openEdit(o)} className="font-semibold text-[#726e60] hover:text-[#20201d]">Edit</button>
          <button onClick={() => handleDelete(o.id)} className="font-semibold text-[#c0392b] hover:underline">Delete</button>
        </span>
      ) : undefined,
    }));
  }

  return (
    <div className="space-y-5">
      {error && <div className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</div>}

      {isAdmin && !showForm && (
        <button
          onClick={openNew}
          className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8]"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          + Add OKR
        </button>
      )}

      {showForm && (
        <FormGrid
          fields={[
            {
              key: "title", label: "Objective",
              input: (
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Grow enterprise customer base by 40%"
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-[11px] py-[9px] text-[12.5px] outline-none focus:border-[#b7452f]"
                />
              ),
            },
            {
              key: "description", label: "Key results / notes",
              input: (
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={"KR1: …\nKR2: …"}
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-[11px] py-[9px] font-mono text-[12px] outline-none focus:border-[#b7452f]"
                />
              ),
            },
            {
              key: "quarter", label: "Quarter",
              input: (
                <select
                  value={form.quarter}
                  onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-[11px] py-[9px] text-[12.5px] outline-none focus:border-[#b7452f]"
                >
                  <option value="">— none —</option>
                  {QUARTERS.map((q) => <option key={q}>{q}</option>)}
                </select>
              ),
            },
            {
              key: "status", label: "Status",
              input: (
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-[11px] py-[9px] text-[12.5px] outline-none focus:border-[#b7452f]"
                >
                  {["draft", "active", "achieved", "missed"].map((s) => <option key={s}>{s}</option>)}
                </select>
              ),
            },
            {
              key: "progress", label: "Progress %",
              input: (
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => setForm((f) => ({ ...f, progress: Math.min(100, Math.max(0, +e.target.value)) }))}
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-[11px] py-[9px] text-[12.5px] outline-none focus:border-[#b7452f]"
                />
              ),
            },
          ]}
          onCancel={cancel}
          onSubmit={handleSave}
          submitLabel={isPending ? "Saving…" : editingId ? "Update" : "Create objective"}
        />
      )}

      <div>
        <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Active Objectives</p>
        {active.length === 0 ? (
          <div className="fw-card px-6 py-8 text-center">
            <p className="mb-2 text-[26px]">🎯</p>
            <p className="text-[12.5px] font-semibold text-[#20201d]">No active OKRs</p>
            <p className="mt-1 text-[11.5px] text-[#a19d90]">Create your first objective to track strategic alignment.</p>
          </div>
        ) : (
          <AdminList items={okrItems(active)} />
        )}
      </div>

      {others.length > 0 && (
        <div>
          <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Past Objectives</p>
          <AdminList items={okrItems(others)} />
        </div>
      )}
    </div>
  );
}
