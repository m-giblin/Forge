"use client";

import { useState, useTransition } from "react";
import { createCustomerAction, updateCustomerAction, deleteCustomerAction } from "./actions";
import type { CustomerAccount } from "@/lib/repositories/customers";

const TIER_OPTIONS = ["enterprise", "mid-market", "smb", "startup", "free"];

function CustomerForm({
  slug,
  initial,
  onDone,
}: {
  slug: string;
  initial?: CustomerAccount;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (initial) {
          await updateCustomerAction(slug, initial.id, fd);
        } else {
          await createCustomerAction(slug, fd);
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Company name *</label>
          <input
            name="name"
            required
            defaultValue={initial?.name}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Domain</label>
          <input
            name="domain"
            placeholder="acme.com"
            defaultValue={initial?.domain ?? ""}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Tier</label>
          <select
            name="tier"
            defaultValue={initial?.tier ?? ""}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          >
            <option value="">—</option>
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">ARR (USD)</label>
          <input
            name="arr_usd"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.arr_usd ?? ""}
            placeholder="0"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Notes</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : initial ? "Save changes" : "Add customer"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CustomersClient({
  slug,
  customers,
  isAdmin,
}: {
  slug: string;
  customers: CustomerAccount[];
  isAdmin: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalArr = customers.reduce((sum, c) => sum + (c.arr_usd ?? 0), 0);

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      await deleteCustomerAction(slug, id);
      setDeleting(null);
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customer Voice</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {customers.length} {customers.length === 1 ? "customer" : "customers"}
            {totalArr > 0 && ` · $${totalArr.toLocaleString()} total ARR`}
          </p>
        </div>
        {isAdmin && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            + Add customer
          </button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-800">New customer</h2>
          <CustomerForm slug={slug} onDone={() => setShowCreate(false)} />
        </div>
      )}

      {customers.length === 0 && !showCreate && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
          No customers yet.{isAdmin ? " Add your first customer above." : ""}
        </div>
      )}

      <div className="space-y-3">
        {customers.map((c) => (
          <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            {editing === c.id ? (
              <CustomerForm slug={slug} initial={c} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900">{c.name}</span>
                    {c.tier && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{c.tier}</span>
                    )}
                    {c.arr_usd != null && c.arr_usd > 0 && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">${c.arr_usd.toLocaleString()}/yr</span>
                    )}
                  </div>
                  {c.domain && <p className="mt-0.5 text-xs text-neutral-400">{c.domain}</p>}
                  {c.notes && <p className="mt-1.5 text-sm text-neutral-600">{c.notes}</p>}
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setEditing(c.id)}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id || isPending}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === c.id ? "…" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
