"use client";

import { useState, useTransition } from "react";
import type { BillingRate, CostRate, Member, Project } from "./actions";
import { upsertBillingRateAction, upsertCostRateAction, deleteRateAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import FormGrid from "@/components/patterns/admin/FormGrid";

function fmtMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
}

function rateLabel(userId: string | null, userName: string | null, roleName: string | null, projectName?: string | null): string {
  if (userId && userName) return projectName ? `${userName} — ${projectName}` : userName;
  if (roleName) return projectName ? `${roleName} (role) — ${projectName}` : `${roleName} (role)`;
  return projectName ? `${projectName} — Global` : "Global rate";
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
  const [delPending, startDel] = useTransition();

  const [scope, setScope] = useState<"user" | "role" | "global">("role");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [addPending, startAdd] = useTransition();

  function resetForm() {
    setScope("role");
    setUserId("");
    setProjectId("");
    setRoleName("");
    setRateInput("");
    setCurrency("USD");
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setError(null);
  }

  function submitAdd() {
    const cents = Math.round(parseFloat(rateInput) * 100);
    if (!rateInput || isNaN(cents) || cents < 0) { setError("Enter a valid hourly rate."); return; }
    setError(null);
    startAdd(async () => {
      const res = tab === "billing"
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
      if (res.ok) {
        resetForm();
        // Re-fetch is not wired server-side; reload page data lazily via location refresh of the affected tab.
        if (tab === "billing") {
          setBilling((prev) => [
            { id: crypto.randomUUID(), userId: userId || null, userName: members.find((m) => m.id === userId)?.name ?? null, projectId: projectId || null, projectName: projects.find((p) => p.id === projectId)?.name ?? null, roleName: scope === "role" ? roleName || null : null, rateCents: cents, currency, effectiveFrom },
            ...prev,
          ]);
        } else {
          setCost((prev) => [
            { id: crypto.randomUUID(), userId: userId || null, userName: members.find((m) => m.id === userId)?.name ?? null, roleName: scope === "role" ? roleName || null : null, costCents: cents, currency, effectiveFrom },
            ...prev,
          ]);
        }
      } else setError(res.error ?? "Failed");
    });
  }

  function deleteRate(table: "billing_rates" | "cost_rates", id: string) {
    if (!confirm("Delete this rate?")) return;
    startDel(async () => {
      await deleteRateAction(slug, table, id);
      if (table === "billing_rates") setBilling((prev) => prev.filter((r) => r.id !== id));
      else setCost((prev) => prev.filter((r) => r.id !== id));
    });
  }

  const rows = tab === "billing" ? billing : cost;

  const tableRows: AdminTableCell[][] = rows.map((r) => {
    const isBilling = tab === "billing";
    const label = isBilling
      ? rateLabel(r.userId, (r as BillingRate).userName, r.roleName, (r as BillingRate).projectName)
      : rateLabel(r.userId, (r as CostRate).userName, r.roleName);
    const amount = isBilling ? (r as BillingRate).rateCents : (r as CostRate).costCents;
    return [
      { kind: "bold", value: label },
      { kind: "text", value: `${fmtMoney(amount, r.currency)}/hr` },
      { kind: "dim", value: r.currency },
      { kind: "dim", value: `from ${r.effectiveFrom}` },
      {
        kind: "link",
        value: "Delete",
        onClick: () => deleteRate(tab === "billing" ? "billing_rates" : "cost_rates", r.id),
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rates"
        subtitle="Hourly rates used for budget and cost reporting"
        right={
          <div className="flex gap-1 rounded-[6px] border border-[#ddd8c9] bg-[#f4f2eb] p-0.5">
            {(["billing", "cost"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-[4px] px-3 py-1 text-[11.5px] font-semibold transition ${
                  tab === t ? "bg-white text-[#20201d] shadow-sm" : "text-[#726e60] hover:text-[#4a473e]"
                }`}
              >
                {t === "billing" ? "Billing rates" : "Internal cost rates"}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-6 px-6">
        <p className="text-[11.5px] text-[#726e60]">
          {tab === "billing" ? "External billing rates used for client invoicing." : "Internal cost rates for profitability tracking."}
        </p>

        {rows.length === 0 ? (
          <div className="fw-card py-16 text-center">
            <p className="text-[12.5px] font-semibold text-[#726e60]">No {tab} rates configured</p>
            <p className="mt-1 text-[11px] text-[#a19d90]">Add a rate below to start tracking time costs for this workspace.</p>
          </div>
        ) : (
          <AdminTable
            minWidth={640}
            columns={[
              { label: "Role / member", flex: true },
              { label: "Rate", width: 130 },
              { label: "Currency", width: 100 },
              { label: "Effective", width: 130 },
              { label: "", width: 90 },
            ]}
            rows={tableRows}
          />
        )}

        <FormGrid
          submitLabel={addPending ? "Adding…" : "Add rate"}
          onCancel={resetForm}
          onSubmit={submitAdd}
          fields={[
            {
              key: "scope",
              label: "Applies to",
              input: (
                <div className="flex gap-1 rounded-[6px] border border-[#ddd8c9] bg-[#f4f2eb] p-0.5">
                  {(["role", "user", "global"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      className={`flex-1 rounded-[4px] py-1 text-[11.5px] font-semibold transition ${
                        scope === s ? "bg-white text-[#20201d] shadow-sm" : "text-[#726e60] hover:text-[#4a473e]"
                      }`}
                    >
                      {s === "user" ? "Per person" : s === "role" ? "Per role" : "Global"}
                    </button>
                  ))}
                </div>
              ),
            },
            ...(scope === "user"
              ? [{
                  key: "member",
                  label: "Team member",
                  input: (
                    <select
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] focus:outline-none focus:ring-2 focus:ring-[#b7452f]/30"
                    >
                      <option value="">Select member…</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ),
                }]
              : []),
            ...(scope === "role"
              ? [{
                  key: "role",
                  label: "Role",
                  input: (
                    <input
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="e.g. engineer, designer"
                      className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-[7px] text-[12px] text-[#20201d] focus:outline-none focus:ring-2 focus:ring-[#b7452f]/30"
                    />
                  ),
                }]
              : []),
            ...(tab === "billing"
              ? [{
                  key: "project",
                  label: "Project (optional)",
                  input: (
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] focus:outline-none focus:ring-2 focus:ring-[#b7452f]/30"
                    >
                      <option value="">All projects</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ),
                }]
              : []),
            {
              key: "rate",
              label: "Hourly rate",
              input: (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  placeholder="150"
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-[7px] text-[12px] text-[#20201d] focus:outline-none focus:ring-2 focus:ring-[#b7452f]/30"
                />
              ),
            },
            {
              key: "currency",
              label: "Currency",
              input: (
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] focus:outline-none focus:ring-2 focus:ring-[#b7452f]/30"
                >
                  {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => <option key={c}>{c}</option>)}
                </select>
              ),
            },
            {
              key: "effectiveFrom",
              label: "Effective from",
              input: (
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-[7px] text-[12px] text-[#20201d] focus:outline-none focus:ring-2 focus:ring-[#b7452f]/30"
                />
              ),
            },
          ]}
        />
        {error && <p className="-mt-3 text-[11.5px] text-[#b23b2e]">{error}</p>}
      </div>
    </div>
  );
}
