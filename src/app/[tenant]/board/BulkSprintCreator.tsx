"use client";

import { useState, useTransition } from "react";
import { bulkCreateSprintsAction } from "./sprintActions";

type BulkSprint = { name: string; goal: string; startDate: string; endDate: string };

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function BulkSprintCreator({
  slug,
  projectId,
  onClose,
  onDone,
}: {
  slug: string;
  projectId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bulkPrefix, setBulkPrefix] = useState("Sprint");
  const [bulkStart, setBulkStart] = useState(toYMD(new Date()));
  const [bulkCadence, setBulkCadence] = useState(14);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkStartNum, setBulkStartNum] = useState(1);
  const [bulkPreview, setBulkPreview] = useState<BulkSprint[] | null>(null);

  function generatePreview() {
    const sprints: BulkSprint[] = [];
    let cur = new Date(bulkStart + "T00:00:00");
    for (let i = 0; i < bulkCount; i++) {
      const s = toYMD(cur);
      const e = toYMD(addDays(cur, bulkCadence - 1));
      sprints.push({ name: `${bulkPrefix} ${bulkStartNum + i}`, goal: "", startDate: s, endDate: e });
      cur = addDays(cur, bulkCadence);
    }
    setBulkPreview(sprints);
  }

  function createBulk(sprints: BulkSprint[]) {
    setError(null);
    startTransition(async () => {
      try {
        await bulkCreateSprintsAction(slug, projectId, sprints);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">Name prefix</label>
          <input value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} placeholder="Sprint"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">Start #</label>
          <input type="number" min={0} value={bulkStartNum} onChange={(e) => setBulkStartNum(parseInt(e.target.value) || 0)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">Count</label>
          <input type="number" min={1} max={52} value={bulkCount} onChange={(e) => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">Cadence</label>
          <select value={bulkCadence} onChange={(e) => setBulkCadence(parseInt(e.target.value))}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900">
            <option value={7}>1 week</option>
            <option value={14}>2 weeks</option>
            <option value={21}>3 weeks</option>
            <option value={28}>4 weeks</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-500 mb-1 block">First sprint starts</label>
        <input type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)}
          className="w-48 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
      </div>

      {!bulkPreview ? (
        <button onClick={generatePreview}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
          Preview {bulkCount} sprint{bulkCount !== 1 ? "s" : ""}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-100 text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Start</th>
                  <th className="px-3 py-2 text-left font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {bulkPreview.map((s, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5 text-neutral-700 font-medium">{s.name}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{s.startDate}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{s.endDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => createBulk(bulkPreview)} disabled={pending}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
              {pending ? "Creating…" : `Create ${bulkPreview.length} sprints`}
            </button>
            <button onClick={() => setBulkPreview(null)} className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
              Edit
            </button>
            <button onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
