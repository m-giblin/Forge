"use client";

import { useState } from "react";

const THRESHOLD_OPTIONS = [
  { value: "", label: "No alert" },
  { value: "75", label: "75%" },
  { value: "80", label: "80%" },
  { value: "90", label: "90%" },
  { value: "100", label: "100%" },
];

export default function ProjectBudgetSettings({
  projectId,
  slug,
  initialBudgetCents,
  initialThresholdPct,
}: {
  projectId: string;
  slug: string;
  initialBudgetCents: number | null;
  initialThresholdPct: number | null;
}) {
  const [budgetInput, setBudgetInput] = useState(
    initialBudgetCents != null ? String(initialBudgetCents / 100) : "",
  );
  const [thresholdInput, setThresholdInput] = useState(
    initialThresholdPct != null ? String(initialThresholdPct) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const budgetCents =
      budgetInput.trim() === "" ? null : Math.round(Number(budgetInput) * 100);
    const budgetAlertThresholdPct =
      thresholdInput === "" ? null : Number(thresholdInput);

    try {
      const res = await fetch(`/api/projects/${projectId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetCents, budgetAlertThresholdPct, slug }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-900">Project Budget</h3>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Total budget
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-neutral-500">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="No budget set"
              className="w-40 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-900"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Alert me when budget reaches
          </label>
          <select
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-900 bg-white"
          >
            {THRESHOLD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
        </div>

        <p className="text-xs text-neutral-400">
          Budget includes both manual expenses and logged time costs (when billing rates are set)
        </p>
      </div>
    </div>
  );
}
