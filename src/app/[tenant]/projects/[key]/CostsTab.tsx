"use client";

import { useState, useTransition } from "react";
import type { ProjectCostsData } from "@/lib/services/projectPortal";
import { setBudgetAction, addSpendAction, removeSpendAction } from "./actions";

const fmt = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function CostsTab({
  slug,
  projectKey,
  data,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  data: ProjectCostsData;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(data.budgetCents != null ? String(data.budgetCents / 100) : "");
  const [showAdd, setShowAdd] = useState(false);

  function run(fn: () => Promise<void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const overBudget = data.budgetCents != null && data.spentCents > data.budgetCents;
  const barColor = data.pct > 100 ? "bg-red-500" : data.pct > 90 ? "bg-red-500" : data.pct > 75 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Budget</p>
            {canEdit && !editingBudget && (
              <button onClick={() => setEditingBudget(true)} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                {data.budgetCents != null ? "Edit" : "Set"}
              </button>
            )}
          </div>
          {editingBudget ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-neutral-400">$</span>
              <input
                autoFocus
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-28 rounded-lg border border-neutral-300 px-2 py-1 text-lg font-bold outline-none focus:border-neutral-900"
                placeholder="0"
              />
              <button
                onClick={() => run(() => setBudgetAction(slug, projectKey, budgetInput === "" ? null : Number(budgetInput)), () => setEditingBudget(false))}
                disabled={isPending}
                className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setEditingBudget(false)} className="text-xs text-neutral-500">Cancel</button>
            </div>
          ) : (
            <p className="mt-1 text-2xl font-bold text-neutral-900">{data.budgetCents != null ? fmt(data.budgetCents) : <span className="text-base font-normal italic text-neutral-400">Not set</span>}</p>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Spent</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{fmt(data.spentCents)}</p>
          {data.budgetCents != null && data.budgetCents > 0 && <p className={`text-xs ${overBudget ? "text-red-600" : "text-amber-600"}`}>{data.pct}% of budget</p>}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Remaining</p>
          {data.budgetCents != null ? (
            <p className={`mt-1 text-2xl font-bold ${overBudget ? "text-red-600" : "text-emerald-600"}`}>{fmt(data.remainingCents)}</p>
          ) : (
            <p className="mt-1 text-base font-normal italic text-neutral-400">Set a budget</p>
          )}
        </div>
      </div>

      {/* Burn bar */}
      {data.budgetCents != null && data.budgetCents > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-700">Burn</span>
            <span className="text-neutral-500">{fmt(data.spentCents)} / {fmt(data.budgetCents)}{overBudget && <span className="ml-1 font-semibold text-red-600">· over budget</span>}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, data.pct)}%` }} />
          </div>
        </div>
      )}

      {/* Spend table */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">Spend</h3>
          {canEdit && (
            <button onClick={() => setShowAdd((s) => !s)} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">
              {showAdd ? "Close" : "+ Add spend"}
            </button>
          )}
        </div>

        {showAdd && <AddSpendForm slug={slug} projectKey={projectKey} pending={isPending} run={run} onDone={() => setShowAdd(false)} />}

        {data.entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No spend logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 text-right font-medium">Amount</th>
                {canEdit && <th className="pb-2" />}
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-t border-neutral-100">
                  <td className="py-2 text-neutral-500">{new Date(e.spentOn + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                  <td className="py-2 text-neutral-800">{e.item}</td>
                  <td className="py-2 text-neutral-500">{e.category ?? "—"}</td>
                  <td className="py-2 text-right font-medium text-neutral-900">{fmt(e.amountCents)}</td>
                  {canEdit && (
                    <td className="py-2 pl-2 text-right">
                      <button onClick={() => run(() => removeSpendAction(slug, projectKey, e.id))} disabled={isPending} className="text-xs text-neutral-400 hover:text-red-600">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AddSpendForm({
  slug,
  projectKey,
  pending,
  run,
  onDone,
}: {
  slug: string;
  projectKey: string;
  pending: boolean;
  run: (fn: () => Promise<void>, after?: () => void) => void;
  onDone: () => void;
}) {
  const [item, setItem] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const input = "rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-900";

  return (
    <div className="mb-4 grid grid-cols-12 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <input className={`${input} col-span-4`} placeholder="What was it?" value={item} onChange={(e) => setItem(e.target.value)} />
      <input className={`${input} col-span-3`} placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
      <input className={`${input} col-span-2`} type="number" placeholder="$ amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input className={`${input} col-span-2`} type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      <button
        onClick={() =>
          run(
            () => addSpendAction(slug, projectKey, { item, category, amountDollars: Number(amount), spentOn }),
            () => { setItem(""); setCategory(""); setAmount(""); setSpentOn(""); onDone(); },
          )
        }
        disabled={pending}
        className="col-span-1 rounded-lg bg-neutral-900 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
