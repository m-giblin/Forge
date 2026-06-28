"use client";

import { useState, useTransition } from "react";
import type { BillingRate, CostRate, Member, Project } from "./actions";
import { upsertBillingRateAction, upsertCostRateAction, deleteRateAction } from "./actions";

function fmtMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
}

function RateLabel({ userId, userName, projectName, roleName }: {
  userId: string | null; userName: string | null; projectName?: string | null; roleName: string | null;
}) {
  if (userId && userName) return (
    <div>
      <p className="text-sm font-medium text-neutral-900">{userName}</p>
      {projectName && <p className="text-xs text-neutral-400">Project: {projectName}</p>}
    </div>
  );
  if (roleName) return (
    <div>
      <p className="text-sm font-medium text-neutral-900 capitalize">{roleName}</p>
      {projectName && <p className="text-xs text-neutral-400">Project: {projectName}</p>}
      <p className="text-xs text-neutral-400">Role rate</p>
    </div>
  );
  return <p className="text-sm font-medium text-neutral-900">{projectName ? `${projectName} — Global` : "Global rate"}</p>;
}

function AddRateModal({
  type,
  members,
  projects,
  slug,
  onDone,
}: {
  type: "billing" | "cost";
  members: Member[];
  projects: Project[];
  slug: string;
  onDone: () => void;
}) {
  const [scope, setScope] = useState<"user" | "role" | "global">("user");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const cents = Math.round(parseFloat(rateInput) * 100);
    if (!rateInput || isNaN(cents) || cents < 0) { setError("Enter a valid hourly rate."); return; }
    setError(null);
    start(async () => {
      const res = type === "billing"
        ? await upsertBillingRateAction(slug, {
            userId: scope === "user" ? userId || undefined : undefined,
            projectId: projectId || undefined,
            roleName: scope === "role" ? roleName || undefined : undefined,
            rateCents: cents, currency, effectiveFrom,
          })
        : await upsertCostRateAction(slug, {
            userId: scope === "user" ? userId || undefined : undefined,
            roleName: scope === "role" ? roleName || undefined : undefined,
            costCents: cents, currency, effectiveFrom,
          });
      if (res.ok) onDone();
      else setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-semibold text-neutral-900">
          Add {type === "billing" ? "Billing" : "Cost"} Rate
        </h3>

        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          {(["user", "role", "global"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition ${
                scope === s ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {s === "user" ? "Per person" : s === "role" ? "Per role" : "Global"}
            </button>
          ))}
        </div>

        {scope === "user" && (
          <div>
            <label className="text-xs font-medium text-neutral-500 block mb-1">Team member</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select member…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        {scope === "role" && (
          <div>
            <label className="text-xs font-medium text-neutral-500 block mb-1">Role name</label>
            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. engineer, designer"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        )}

        {type === "billing" && (
          <div>
            <label className="text-xs font-medium text-neutral-500 block mb-1">Project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-neutral-500 block mb-1">Hourly rate ($/hr)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              placeholder="150"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="w-24">
            <label className="text-xs font-medium text-neutral-500 block mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {["USD","EUR","GBP","CAD","AUD"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-500 block mb-1">Effective from</label>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onDone} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add Rate
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RatesClient({
  slug, initialBilling, initialCost, members, projects,
}: {
  slug: string;
  initialBilling: BillingRate[];
  initialCost: CostRate[];
  members: Member[];
  projects: Project[];
}) {
  const [tab, setTab] = useState<"billing" | "cost">("billing");
  const [billing, setBilling] = useState(initialBilling);
  const [cost, setCost] = useState(initialCost);
  const [adding, setAdding] = useState(false);
  const [delPending, startDel] = useTransition();

  function deleteRate(table: "billing_rates" | "cost_rates", id: string) {
    if (!confirm("Delete this rate?")) return;
    startDel(async () => {
      await deleteRateAction(slug, table, id);
      if (table === "billing_rates") setBilling((prev) => prev.filter((r) => r.id !== id));
      else setCost((prev) => prev.filter((r) => r.id !== id));
    });
  }

  const rows = tab === "billing" ? billing : cost;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-neutral-900">Rates</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {tab === "billing" ? "External billing rates used for client invoicing." : "Internal cost rates for profitability tracking."}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
        >
          + Add Rate
        </button>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {(["billing", "cost"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "billing" ? "💰 Billing Rates" : "🔒 Internal Cost Rates"}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 py-16 text-center">
          <p className="text-sm font-medium text-neutral-500">No {tab} rates configured</p>
          <p className="text-xs text-neutral-400 mt-1">Add a rate to start tracking time costs for this workspace.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition">
              <div className="flex-1 min-w-0">
                {tab === "billing" ? (
                  <RateLabel
                    userId={(r as BillingRate).userId}
                    userName={(r as BillingRate).userName}
                    projectName={(r as BillingRate).projectName}
                    roleName={(r as BillingRate).roleName}
                  />
                ) : (
                  <RateLabel
                    userId={(r as CostRate).userId}
                    userName={(r as CostRate).userName}
                    roleName={(r as CostRate).roleName}
                  />
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-neutral-900">
                  {fmtMoney(tab === "billing" ? (r as BillingRate).rateCents : (r as CostRate).costCents, r.currency)}/hr
                </p>
                <p className="text-xs text-neutral-400">from {r.effectiveFrom}</p>
              </div>
              <button
                onClick={() => deleteRate(tab === "billing" ? "billing_rates" : "cost_rates", r.id)}
                disabled={delPending}
                className="text-neutral-300 hover:text-red-400 transition text-lg disabled:opacity-50"
                title="Delete rate"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddRateModal
          type={tab}
          members={members}
          projects={projects}
          slug={slug}
          onDone={() => setAdding(false)}
        />
      )}
    </div>
  );
}
