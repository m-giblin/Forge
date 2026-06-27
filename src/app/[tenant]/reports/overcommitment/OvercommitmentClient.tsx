"use client";

import { useState } from "react";
import Link from "next/link";

export type OvercommitmentMember = {
  userId: string;
  name: string;
  committedHours: number;
  capacityHours: number;
  load: number;
  sprints: { projectKey: string; sprintName: string; hours: number }[];
};

function loadColor(load: number): { ring: string; bg: string; text: string } {
  if (load >= 100) return { ring: "border-red-300", bg: "bg-red-500", text: "text-red-700" };
  if (load >= 80) return { ring: "border-amber-300", bg: "bg-amber-400", text: "text-amber-700" };
  return { ring: "border-emerald-300", bg: "bg-emerald-500", text: "text-emerald-700" };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CapacityBar({ load, bg }: { load: number; bg: string }) {
  const clamped = Math.min(100, load);
  const overflow = load > 100;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${overflow ? "bg-red-400" : bg} transition-all`}
        style={{ width: `${clamped}%` }}
      />
      {overflow && (
        <div
          className="absolute inset-y-0 right-0 h-full rounded-full"
          style={{
            width: `${Math.min(100, load - 100)}%`,
            background: "repeating-linear-gradient(45deg, #ef4444 0, #ef4444 3px, transparent 3px, transparent 6px)",
          }}
        />
      )}
    </div>
  );
}

export default function OvercommitmentClient({
  slug,
  members,
}: {
  slug: string;
  members: OvercommitmentMember[];
}) {
  const [filter, setFilter] = useState<"all" | "over">("all");

  const overCount = members.filter((m) => m.load >= 100).length;
  const atCount = members.filter((m) => m.load >= 80 && m.load < 100).length;
  const okCount = members.filter((m) => m.load < 80).length;

  const visible = filter === "over" ? members.filter((m) => m.load >= 100) : members;

  return (
    <div className="space-y-6">
      <Link href={`/${slug}/reports`} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors group">
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Reports
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Cross-Project Overcommitment</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Members committed across active sprints vs their weekly capacity
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-neutral-200 bg-white overflow-hidden text-sm">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 font-medium transition ${filter === "all" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
          >
            All members
          </button>
          <button
            onClick={() => setFilter("over")}
            className={`px-4 py-1.5 font-medium transition ${filter === "over" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
          >
            Overcommitted only
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
            {overCount} overcommitted
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
            {atCount} at limit
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
            {okCount} OK
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-medium text-neutral-700">No cross-project conflicts detected</p>
          <p className="text-xs text-neutral-400 mt-1">All members are within capacity.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => {
            const c = loadColor(m.load);
            return (
              <div
                key={m.userId}
                className={`rounded-xl border bg-white p-4 ${c.ring}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${m.load >= 100 ? "bg-red-500" : m.load >= 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                  >
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{m.name}</p>
                    <span className={`text-xs font-medium ${c.text}`}>{m.load}% load</span>
                  </div>
                </div>

                <CapacityBar load={m.load} bg={c.bg} />
                <p className="mt-1.5 text-xs text-neutral-500">
                  {m.committedHours.toFixed(1)}h committed of {m.capacityHours.toFixed(1)}h available
                </p>

                {m.sprints.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.sprints.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700"
                      >
                        [{s.projectKey}] {s.sprintName} → {s.hours.toFixed(1)}h
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
