"use client";

import { useState, useEffect, useTransition } from "react";
import { getMyAvailabilityAction, saveMyAvailabilityAction } from "./actions";
import { useParams } from "next/navigation";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AvailabilityPage() {
  const params = useParams();
  const slug = params.tenant as string;

  const [hoursPerWeek, setHoursPerWeek] = useState(40);
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMyAvailabilityAction(slug).then((row) => {
      setHoursPerWeek(row.hours_per_week);
      setWorkDays(row.work_days);
      setLoaded(true);
    });
  }, [slug]);

  function toggleDay(day: number) {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
    setSaved(false);
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveMyAvailabilityAction(slug, hoursPerWeek, workDays);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-sm text-neutral-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">Availability</h1>
        <p className="text-sm text-neutral-500">
          Set your working hours and days so sprint planning can account for your capacity.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-700">
            Hours per week
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0.5}
              max={80}
              step={0.5}
              value={hoursPerWeek}
              onChange={(e) => {
                setHoursPerWeek(parseFloat(e.target.value) || 0);
                setSaved(false);
              }}
              className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <span className="text-sm text-neutral-500">hours / week</span>
          </div>
          <p className="text-xs text-neutral-400">Between 0.5 and 80 hours.</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-700">Work days</p>
          <div className="flex gap-2 flex-wrap">
            {DAY_LABELS.map((label, idx) => {
              const active = workDays.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-600 hover:border-indigo-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          {saved && <p className="text-sm text-emerald-600">Saved.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
