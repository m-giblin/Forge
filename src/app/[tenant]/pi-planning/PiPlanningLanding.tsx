"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPiCycleAction, setPiCycleStatusAction, deletePiCycleAction } from "./actions";

type Cycle = { id: string; name: string; startDate: string; endDate: string; status: "planning" | "active" | "completed" };

const STATUS_STYLE: Record<Cycle["status"], string> = {
  planning: "bg-neutral-100 text-neutral-600",
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-indigo-100 text-indigo-700",
};

export default function PiPlanningLanding({ slug, cycles: initialCycles }: { slug: string; cycles: Cycle[] }) {
  const router = useRouter();
  const [cycles, setCycles] = useState(initialCycles);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    if (!name.trim() || !startDate || !endDate) return;
    setError(null);
    startTransition(async () => {
      try {
        const id = await createPiCycleAction(slug, name.trim(), startDate, endDate);
        router.push(`/${slug}/pi-planning/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create PI");
      }
    });
  }

  function setStatus(id: string, status: Cycle["status"]) {
    startTransition(async () => {
      try {
        await setPiCycleStatusAction(slug, id, status);
        setCycles((c) => c.map((x) => (x.id === id ? { ...x, status } : x)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update status");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deletePiCycleAction(slug, id);
        setCycles((c) => c.filter((x) => x.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-neutral-900">PI Planning</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Program Increment objectives, scoped to a fixed planning window across every team — each with a 5-dot confidence vote.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Different from <Link href={`/${slug}/admin/okrs`} className="underline hover:text-neutral-600">OKRs</Link> in the gear menu — OKRs are company-wide goals tied to Think Tank ideas, not team-scoped or confidence-voted. Use PI Planning for &ldquo;what will each team commit to this increment,&rdquo; OKRs for &ldquo;what are we trying to achieve this quarter.&rdquo;
        </p>
      </div>

      {error && <p className="my-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6">
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700">
            + New PI
          </button>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">New Program Increment</h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Name</label>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PI 2026.3" className="w-48 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">End date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={create} disabled={pending || !name.trim() || !startDate || !endDate} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                Create
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {cycles.length === 0 && !showForm && <p className="text-sm text-neutral-400">No Program Increments yet.</p>}
        {cycles.map((c) => (
          <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Link href={`/${slug}/pi-planning/${c.id}`} className="font-medium text-neutral-900 hover:underline">{c.name}</Link>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[c.status]}`}>{c.status}</span>
              <span className="ml-auto text-xs text-neutral-400">{c.startDate} → {c.endDate}</span>
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              {c.status !== "active" && <button onClick={() => setStatus(c.id, "active")} disabled={pending} className="text-neutral-500 hover:text-neutral-800 disabled:opacity-50">Mark active</button>}
              {c.status !== "completed" && <button onClick={() => setStatus(c.id, "completed")} disabled={pending} className="text-neutral-500 hover:text-neutral-800 disabled:opacity-50">Mark completed</button>}
              <button onClick={() => remove(c.id)} disabled={pending} className="text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
