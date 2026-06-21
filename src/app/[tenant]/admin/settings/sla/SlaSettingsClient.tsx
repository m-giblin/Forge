"use client";

import { useState, useTransition } from "react";
import type { SlaPolicy, SlaTier } from "@/lib/repositories/slaPolicies";
import { createSlaPolicyAction, updateSlaPolicyAction, deleteSlaPolicyAction } from "./actions";

const PRIORITIES = ["critical", "high", "medium", "low"];
const TIER_TYPES = ["response", "resolution"] as const;

function emptyPolicy(): { name: string; conditions: { priority: string[] }; tiers: SlaTier[] } {
  return { name: "", conditions: { priority: [] }, tiers: [] };
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
    <div className="flex gap-2 items-center">
      <select
        value={tier.type}
        onChange={(e) => onChange({ ...tier, type: e.target.value as SlaTier["type"] })}
        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
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
        className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
        placeholder="Hours"
      />
      <span className="text-xs text-zinc-500">h → notify</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-red-400 hover:text-red-300"
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
}: {
  initial: ReturnType<typeof emptyPolicy>;
  onSave: (v: typeof initial) => void;
  onCancel: () => void;
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

  return (
    <div className="space-y-4 border border-zinc-700 rounded-lg p-5 bg-zinc-800/40">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Policy name</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="P0 Response SLA"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-2">Apply to priorities (leave empty for all)</label>
        <div className="flex gap-2 flex-wrap">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePriority(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                form.conditions.priority.includes(p)
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "border-zinc-600 text-zinc-400 hover:border-zinc-400"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-zinc-400">SLA tiers</label>
        {form.tiers.map((t, i) => (
          <TierRow key={i} tier={t} onChange={(v) => updateTier(i, v)} onRemove={() => removeTier(i)} />
        ))}
        <button
          type="button"
          onClick={addTier}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          + Add tier
        </button>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || form.tiers.length === 0}
          className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-md"
        >
          Save policy
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded-md"
        >
          Cancel
        </button>
      </div>
    </div>
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
    startTransition(async () => {
      await deleteSlaPolicyAction(slug, id);
      setPolicies((ps) => ps.filter((p) => p.id !== id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">SLA Policies</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Define response and resolution deadlines. Breaches fire a Slack notification and are logged to the issue timeline.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md whitespace-nowrap"
          >
            + New policy
          </button>
        )}
      </div>

      {creating && (
        <PolicyForm
          initial={emptyPolicy()}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {policies.length === 0 && !creating && (
        <div className="border border-zinc-800 rounded-lg p-8 text-center text-zinc-500 text-sm">
          No SLA policies yet. Create one to start tracking response and resolution times.
        </div>
      )}

      <div className="space-y-3">
        {policies.map((p) =>
          editId === p.id ? (
            <PolicyForm
              key={p.id}
              initial={{ name: p.name, conditions: { priority: p.conditions.priority ?? [] }, tiers: p.tiers }}
              onSave={(form) => handleUpdate(p.id, form)}
              onCancel={() => setEditId(null)}
            />
          ) : (
            <div key={p.id} className={`border rounded-lg p-4 ${p.enabled ? "border-green-700 bg-green-950/30" : "border-zinc-600 bg-zinc-800/60"}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${p.enabled ? "bg-green-400" : "bg-zinc-500"}`} />
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  {(p.conditions.priority ?? []).length > 0 && (
                    <div className="flex gap-1 flex-shrink-0">
                      {(p.conditions.priority ?? []).map((pr) => (
                        <span key={pr} className="px-2 py-0.5 bg-zinc-600 text-xs text-zinc-200 rounded-full">
                          {pr}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(p.id, !p.enabled)}
                    disabled={isPending}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                      p.enabled
                        ? "bg-zinc-600 hover:bg-zinc-500 text-white"
                        : "bg-green-600 hover:bg-green-500 text-white"
                    }`}
                  >
                    {p.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => setEditId(p.id)}
                    className="px-3 py-1 text-xs rounded-md font-medium bg-zinc-600 hover:bg-zinc-500 text-white transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={isPending}
                    className="px-3 py-1 text-xs rounded-md font-medium bg-red-900/60 hover:bg-red-800 text-red-300 hover:text-red-200 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {p.tiers.map((t, i) => (
                  <span key={i} className="text-xs text-zinc-300 bg-zinc-700 px-2.5 py-1 rounded-md">
                    {t.type === "response" ? "Assign" : "Resolve"} within {t.hours}h
                  </span>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      <div className="border border-zinc-800 rounded-lg p-4 text-xs text-zinc-500 space-y-1">
        <p className="font-semibold text-zinc-400">How it works</p>
        <p>• A cron job checks every 5 minutes for SLA breaches across all open issues</p>
        <p>• On breach: Slack alert fires (if configured) + a comment is posted to the issue timeline</p>
        <p>• Each breach fires once — won&apos;t spam on every cron tick</p>
        <p>• SLA timer chip appears on issue cards and the detail page</p>
      </div>
    </div>
  );
}
