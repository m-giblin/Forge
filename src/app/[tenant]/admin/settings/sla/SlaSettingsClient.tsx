"use client";

import { useState, useTransition } from "react";
import type { SlaPolicy, SlaTier } from "@/lib/repositories/slaPolicies";
import { createSlaPolicyAction, updateSlaPolicyAction, deleteSlaPolicyAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import FormGrid from "@/components/patterns/admin/FormGrid";

const PRIORITIES = ["critical", "high", "medium", "low"];
const TIER_TYPES = ["response", "resolution"] as const;
const ACTIONS = ["notify", "reassign"] as const;

const inputCls =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] placeholder-[#a19d90] outline-none focus:border-[#b7452f]";

function emptyPolicy(): { name: string; conditions: { priority: string[] }; tiers: SlaTier[] } {
  return { name: "", conditions: { priority: [] }, tiers: [] };
}

function tierSummary(tiers: SlaTier[], type: SlaTier["type"]): string {
  const hits = tiers.filter((t) => t.type === type);
  if (hits.length === 0) return "—";
  return hits.map((t) => `${t.hours}h`).join(", ");
}

function TierRow({
  tier,
  onChange,
  onRemove,
}: {
  tier: SlaTier;
  onChange: (t: SlaTier) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={tier.type}
        onChange={(e) => onChange({ ...tier, type: e.target.value as SlaTier["type"] })}
        className={`${inputCls} w-auto`}
      >
        {TIER_TYPES.map((t) => (
          <option key={t} value={t}>
            {t === "response" ? "Response (assign by)" : "Resolution (close by)"}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        value={tier.hours}
        onChange={(e) => onChange({ ...tier, hours: Number(e.target.value) })}
        className={`${inputCls} w-20`}
        placeholder="Hours"
      />
      <span className="text-[11px] text-[#a19d90]">h →</span>
      <select
        value={tier.action}
        onChange={(e) => onChange({ ...tier, action: e.target.value as SlaTier["action"] })}
        className={`${inputCls} w-auto`}
      >
        {ACTIONS.map((a) => (
          <option key={a} value={a}>
            {a === "notify" ? "notify" : "reassign"}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="text-[11.5px] font-semibold text-[#b7452f] hover:underline"
      >
        remove
      </button>
    </div>
  );
}

function PolicyForm({
  initial,
  onSave,
  onCancel,
  saving,
  submitLabel,
}: {
  initial: ReturnType<typeof emptyPolicy>;
  onSave: (v: typeof initial) => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState(initial);

  function togglePriority(p: string) {
    setForm((f) => ({
      ...f,
      conditions: {
        priority: f.conditions.priority.includes(p)
          ? f.conditions.priority.filter((x) => x !== p)
          : [...f.conditions.priority, p],
      },
    }));
  }

  function addTier() {
    setForm((f) => ({ ...f, tiers: [...f.tiers, { type: "response", hours: 4, action: "notify" }] }));
  }

  function updateTier(i: number, t: SlaTier) {
    setForm((f) => ({ ...f, tiers: f.tiers.map((x, idx) => (idx === i ? t : x)) }));
  }

  function removeTier(i: number) {
    setForm((f) => ({ ...f, tiers: f.tiers.filter((_, idx) => idx !== i) }));
  }

  const canSave = form.name.trim().length > 0 && form.tiers.length > 0;

  return (
    <FormGrid
      fields={[
        {
          key: "name",
          label: "Policy name",
          input: (
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="P0 Response SLA"
              className={inputCls}
            />
          ),
        },
        {
          key: "priorities",
          label: "Priorities (leave empty for all)",
          input: (
            <div className="flex flex-wrap gap-1.5 py-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    form.conditions.priority.includes(p)
                      ? "border-[#5e2c1f] text-[#f2e9d8]"
                      : "border-[#ddd8c9] bg-white text-[#726e60] hover:border-[#b7452f]/50"
                  }`}
                  style={
                    form.conditions.priority.includes(p)
                      ? { background: "linear-gradient(160deg,#9a5138,#6e3324)" }
                      : undefined
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          ),
        },
        {
          key: "tiers",
          label: "SLA tiers",
          input: (
            <div className="space-y-2">
              {form.tiers.map((t, i) => (
                <TierRow key={i} tier={t} onChange={(v) => updateTier(i, v)} onRemove={() => removeTier(i)} />
              ))}
              <button
                type="button"
                onClick={addTier}
                className="text-[11.5px] font-semibold text-[#b7452f] hover:underline"
              >
                + Add tier
              </button>
            </div>
          ),
        },
      ]}
      onCancel={onCancel}
      onSubmit={canSave && !saving ? () => onSave(form) : undefined}
      submitLabel={saving ? "Saving…" : submitLabel}
    />
  );
}

export default function SlaSettingsClient({ slug, policies: initial }: { slug: string; policies: SlaPolicy[] }) {
  const [policies, setPolicies] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(form: ReturnType<typeof emptyPolicy>) {
    startTransition(async () => {
      await createSlaPolicyAction(slug, form.name, form.conditions, form.tiers);
      setCreating(false);
    });
  }

  function handleUpdate(id: string, form: ReturnType<typeof emptyPolicy>) {
    startTransition(async () => {
      await updateSlaPolicyAction(slug, id, form);
      setEditId(null);
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    startTransition(async () => {
      await updateSlaPolicyAction(slug, id, { enabled });
      setPolicies((ps) => ps.map((p) => (p.id === id ? { ...p, enabled } : p)));
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this SLA policy?")) return;
    startTransition(async () => {
      await deleteSlaPolicyAction(slug, id);
      setPolicies((ps) => ps.filter((p) => p.id !== id));
    });
  }

  const editingPolicy = editId ? policies.find((p) => p.id === editId) : null;

  const rows: AdminTableCell[][] = policies.map((p) => [
    { kind: "bold", value: p.name },
    {
      kind: "dim",
      value: (p.conditions.priority ?? []).length > 0 ? (p.conditions.priority ?? []).join(", ") : "All priorities",
    },
    { kind: "mono", value: tierSummary(p.tiers, "response") },
    { kind: "mono", value: tierSummary(p.tiers, "resolution") },
    {
      kind: "chip",
      value: p.enabled ? "Active" : "Disabled",
      chipFg: p.enabled ? "#2f6b33" : "#726e60",
      chipBg: p.enabled ? "#e3efe1" : "#eae6da",
      onClick: () => handleToggle(p.id, !p.enabled),
    },
    { kind: "link", value: "Edit", onClick: () => setEditId(p.id) },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Policies"
        subtitle="Response and resolution targets by priority"
        right={
          !creating &&
          !editId && (
            <button
              onClick={() => setCreating(true)}
              className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] whitespace-nowrap"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              + New policy
            </button>
          )
        }
      />

      <div className="space-y-6 px-6">
        {editingPolicy && (
          <div className="space-y-1">
            <p className="px-0.5 text-[12.5px] font-bold text-[#20201d]">Edit policy</p>
            <PolicyForm
              key={editingPolicy.id}
              initial={{
                name: editingPolicy.name,
                conditions: { priority: editingPolicy.conditions.priority ?? [] },
                tiers: editingPolicy.tiers,
              }}
              onSave={(form) => handleUpdate(editingPolicy.id, form)}
              onCancel={() => setEditId(null)}
              saving={isPending}
              submitLabel="Save changes"
            />
          </div>
        )}

        {creating && (
          <div className="space-y-1">
            <p className="px-0.5 text-[12.5px] font-bold text-[#20201d]">New policy</p>
            <PolicyForm
              initial={emptyPolicy()}
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              saving={isPending}
              submitLabel="Save policy"
            />
          </div>
        )}

        {policies.length === 0 && !creating ? (
          <div className="fw-card px-8 py-10 text-center text-[12.5px] text-[#a19d90]">
            No SLA policies yet. Create one to start tracking response and resolution times.
          </div>
        ) : (
          <AdminTable
            columns={[
              { label: "Policy", flex: true },
              { label: "Applies to", width: 190 },
              { label: "Response", width: 140 },
              { label: "Resolution", width: 140 },
              { label: "Status", width: 120 },
              { label: "", width: 90 },
            ]}
            rows={rows}
          />
        )}

        <div className="fw-card px-4 py-3.5 text-[11.5px] text-[#726e60] space-y-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">How it works</p>
          <p>A cron job checks every 5 minutes for SLA breaches across all open issues.</p>
          <p>On breach: a Slack alert fires (if configured) and a comment is posted to the issue timeline.</p>
          <p>Each breach fires once — it won&apos;t spam on every cron tick.</p>
          <p>An SLA timer chip appears on issue cards and the detail page.</p>
        </div>
      </div>
    </div>
  );
}
