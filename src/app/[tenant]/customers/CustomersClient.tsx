"use client";

import { useState, useTransition } from "react";
import { createCustomerAction, updateCustomerAction, deleteCustomerAction } from "./actions";
import type { CustomerAccount } from "@/lib/repositories/customers";
import PageHeader from "@/components/patterns/PageHeader";

const TIER_OPTIONS = ["enterprise", "mid-market", "smb", "startup", "free"];

/** Tier pill colors, re-themed to the Ember Rust palette (§3). */
const TIER_PILL: Record<string, { fg: string; bg: string }> = {
  enterprise: { fg: "#7a4fa0", bg: "#f4ecfa" },
  "mid-market": { fg: "#3a6ea8", bg: "#eaf1f8" },
  smb: { fg: "#a19d90", bg: "#f1efe9" },
  startup: { fg: "#3f7d4c", bg: "#e9f3ea" },
  free: { fg: "#a19d90", bg: "#f1efe9" },
};

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

  const field = "w-full rounded-md border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-2 text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]";
  const label = "mb-1 block text-[11px] font-semibold text-[#726e60]";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Company name *</label>
          <input name="name" required defaultValue={initial?.name} className={field} />
        </div>
        <div>
          <label className={label}>Domain</label>
          <input name="domain" placeholder="acme.com" defaultValue={initial?.domain ?? ""} className={field} />
        </div>
        <div>
          <label className={label}>Tier</label>
          <select name="tier" defaultValue={initial?.tier ?? ""} className={field}>
            <option value="">—</option>
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>ARR (USD)</label>
          <input
            name="arr_usd"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.arr_usd ?? ""}
            placeholder="0"
            className={field}
          />
        </div>
      </div>
      <div>
        <label className={label}>Notes</label>
        <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className={field} />
      </div>
      {error && <p className="text-[11px] text-[#c0392b]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[5px] border border-[#5e2c1f] px-4 py-2 text-[11.5px] font-bold text-[#f2e9d8] disabled:opacity-50"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          {isPending ? "Saving…" : initial ? "Save changes" : "Add customer"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
        >
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
    <main className="flex h-[calc(100vh-56px)] flex-col overflow-hidden md:h-screen">
      <PageHeader
        title="Customer Voice"
        subtitle={`${customers.length} ${customers.length === 1 ? "customer" : "customers"}${totalArr > 0 ? ` · $${totalArr.toLocaleString()} total ARR` : ""}`}
        right={
          isAdmin && !showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-[5px] border border-[#5e2c1f] px-[13px] py-[7px] text-[12px] font-bold text-[#f2e9d8]"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              + Add customer
            </button>
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px] pb-7">
        <div className="flex max-w-[1000px] flex-col gap-3">
          {showCreate && (
            <div className="fw-card p-5">
              <h2 className="mb-4 text-[13px] font-bold text-[#20201d]">New customer</h2>
              <CustomerForm slug={slug} onDone={() => setShowCreate(false)} />
            </div>
          )}

          {customers.length === 0 && !showCreate && (
            <div className="fw-card border-dashed p-10 text-center text-[12.5px] text-[#a19d90]">
              No customers yet.{isAdmin ? " Add your first customer above." : ""}
            </div>
          )}

          {customers.map((c) => {
            const tierPill = c.tier ? TIER_PILL[c.tier] : undefined;
            return (
              <div key={c.id} className="fw-card p-4 sm:px-[18px] sm:py-4">
                {editing === c.id ? (
                  <CustomerForm slug={slug} initial={c} onDone={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[14px] font-bold text-[#20201d]">{c.name}</span>
                        {c.tier && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ color: tierPill?.fg ?? "#a19d90", backgroundColor: tierPill?.bg ?? "#f1efe9" }}
                          >
                            {c.tier}
                          </span>
                        )}
                        <div className="flex-1" />
                        {c.arr_usd != null && c.arr_usd > 0 && (
                          <>
                            <span
                              className="font-[family-name:var(--font-manrope)] text-[15px] font-extrabold text-[#8c4632]"
                            >
                              ${c.arr_usd.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-[#a19d90]">ARR</span>
                          </>
                        )}
                      </div>
                      {c.domain && <p className="mt-0.5 text-[11px] text-[#a19d90]">{c.domain}</p>}
                      {c.notes && <p className="mt-2 text-[12px] leading-[1.5] text-[#726e60]">{c.notes}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => setEditing(c.id)}
                          className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deleting === c.id || isPending}
                          className="rounded-[5px] border border-[#f0cfc9] px-3 py-1.5 text-[11px] font-semibold text-[#c0392b] hover:bg-[#fbeae8] disabled:opacity-50"
                        >
                          {deleting === c.id ? "…" : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
