"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPiCycleAction, setPiCycleStatusAction, deletePiCycleAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import AdminList from "@/components/patterns/admin/AdminList";

type Cycle = { id: string; name: string; startDate: string; endDate: string; status: "planning" | "active" | "completed" };

const STATUS_COLOR: Record<Cycle["status"], string> = {
  planning: "#a19d90",
  active: "#3f7d4c",
  completed: "#7a4fa0",
};
const STATUS_TINT: Record<Cycle["status"], string> = {
  planning: "#f1efe9",
  active: "#e9f3ea",
  completed: "#f4ecfa",
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
    <div>
      <PageHeader title="PI Planning" subtitle="Cross-team objectives and confidence for the increment" />

      <div className="mx-auto max-w-2xl space-y-5 px-6 py-5">
        <p className="text-[11.5px] text-[#a19d90]">
          Different from <Link href={`/${slug}/admin/okrs`} className="font-semibold text-[#b7452f] hover:underline">OKRs</Link> in the gear menu — OKRs are company-wide goals tied to Think Tank ideas, not team-scoped or confidence-voted. Use PI Planning for &ldquo;what will each team commit to this increment,&rdquo; OKRs for &ldquo;what are we trying to achieve this quarter.&rdquo;
        </p>

        {error && <p className="rounded-[6px] bg-[#fbeae8] px-3.5 py-2.5 text-[12px] text-[#c0392b]">{error}</p>}

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-[5px] border border-dashed border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2 text-[12.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
          >
            + New PI
          </button>
        ) : (
          <div className="fw-card px-4 py-4">
            <h3 className="mb-3 text-[13px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">New Program Increment</h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Name</label>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PI 2026.3" className="w-48 rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">End date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#b7452f]" />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={create}
                disabled={pending || !name.trim() || !startDate || !endDate}
                className="rounded-[5px] border border-[#5e2c1f] px-4 py-2 text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                Create
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-[5px] px-4 py-2 text-[12px] font-semibold text-[#a19d90] hover:bg-[#eae6da]">Cancel</button>
            </div>
          </div>
        )}

        {cycles.length === 0 && !showForm ? (
          <p className="text-[12.5px] text-[#a19d90]">No Program Increments yet.</p>
        ) : (
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">Program Increments</p>
            <AdminList
              items={cycles.map((c) => ({
                key: c.id,
                title: (
                  <span className="flex items-center gap-2">
                    <Link href={`/${slug}/pi-planning/${c.id}`} className="hover:underline">{c.name}</Link>
                    <span
                      className="rounded-full px-2 py-[3px] text-[10.5px] font-bold"
                      style={{ color: STATUS_COLOR[c.status], backgroundColor: STATUS_TINT[c.status] }}
                    >
                      {c.status}
                    </span>
                  </span>
                ),
                subline: (
                  <span className="flex items-center gap-3">
                    <span>{c.startDate} → {c.endDate}</span>
                    {c.status !== "active" && (
                      <button onClick={() => setStatus(c.id, "active")} disabled={pending} className="font-semibold text-[#b7452f] hover:underline disabled:opacity-50">Mark active</button>
                    )}
                    {c.status !== "completed" && (
                      <button onClick={() => setStatus(c.id, "completed")} disabled={pending} className="font-semibold text-[#b7452f] hover:underline disabled:opacity-50">Mark completed</button>
                    )}
                    <button onClick={() => remove(c.id)} disabled={pending} className="font-semibold text-[#c0392b] hover:underline disabled:opacity-50">Delete</button>
                  </span>
                ),
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
