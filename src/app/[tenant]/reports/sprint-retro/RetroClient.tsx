"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SprintRef {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
}

interface IssueRetro {
  id: string;
  key: string;
  title: string;
  assigneeName: string;
  estimateMinutes: number;
  loggedMinutes: number;
}

function SortTh({
  col,
  label,
  sortKey,
  sortAsc,
  onSort,
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (col: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      className="text-right px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer select-none hover:text-indigo-600"
      onClick={() => onSort(col)}
    >
      {label} {active ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );
}

function fmtH(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "-";
  return sign + fmtH(Math.abs(delta));
}

type SortKey = "key" | "title" | "assigneeName" | "estimateMinutes" | "loggedMinutes" | "delta";

export default function RetroClient({
  slug,
  sprints,
  selectedSprintId,
  issues,
}: {
  slug: string;
  sprints: SprintRef[];
  selectedSprintId: string | null;
  issues: IssueRetro[];
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("delta");
  const [sortAsc, setSortAsc] = useState(false);

  function handleSprintChange(id: string) {
    router.push(`/${slug}/reports/sprint-retro?sprintId=${id}`);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(key !== "delta");
    }
  }

  const sorted = useMemo(() => {
    return [...issues].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortKey === "key") { va = a.key; vb = b.key; }
      else if (sortKey === "title") { va = a.title; vb = b.title; }
      else if (sortKey === "assigneeName") { va = a.assigneeName; vb = b.assigneeName; }
      else if (sortKey === "estimateMinutes") { va = a.estimateMinutes; vb = b.estimateMinutes; }
      else if (sortKey === "loggedMinutes") { va = a.loggedMinutes; vb = b.loggedMinutes; }
      else if (sortKey === "delta") {
        va = Math.abs(a.loggedMinutes - a.estimateMinutes);
        vb = Math.abs(b.loggedMinutes - b.estimateMinutes);
      }
      if (typeof va === "string" && typeof vb === "string") {
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [issues, sortKey, sortAsc]);

  const plannedMinutes = issues.reduce((s, i) => s + i.estimateMinutes, 0);
  const loggedMinutes = issues.reduce((s, i) => s + i.loggedMinutes, 0);
  const variance = loggedMinutes - plannedMinutes;
  const doneCount = issues.length;

  const memberMap = new Map<string, number>();
  for (const i of issues) {
    memberMap.set(i.assigneeName, (memberMap.get(i.assigneeName) ?? 0) + i.loggedMinutes);
  }
  const memberEntries = Array.from(memberMap.entries()).sort((a, b) => b[1] - a[1]);
  const maxMemberMin = Math.max(1, ...memberEntries.map((e) => e[1]));

  function exportCsv() {
    const rows = [
      ["Issue", "Title", "Assignee", "Est (min)", "Logged (min)", "Delta (min)"],
      ...issues.map((i) => [
        i.key,
        `"${i.title.replace(/"/g, '""')}"`,
        i.assigneeName,
        String(i.estimateMinutes),
        String(i.loggedMinutes),
        String(i.loggedMinutes - i.estimateMinutes),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sprint-retro.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <main className="w-full px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Sprint Retrospective</h1>
        <button
          onClick={exportCsv}
          className="px-3 py-1.5 text-sm border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg font-medium"
        >
          Export CSV
        </button>
      </div>

      {sprints.length > 0 && (
        <select
          value={selectedSprintId ?? ""}
          onChange={(e) => handleSprintChange(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.projectName} — {s.name}
            </option>
          ))}
        </select>
      )}

      {sprints.length === 0 && (
        <p className="text-neutral-500">No completed sprints found.</p>
      )}

      {sprints.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Planned", value: fmtH(plannedMinutes), color: "text-neutral-700" },
              { label: "Logged", value: fmtH(loggedMinutes), color: "text-indigo-600" },
              {
                label: "Variance",
                value: fmtDelta(variance),
                color: variance > 0 ? "text-red-600" : "text-green-600",
              },
              { label: "Issues", value: String(doneCount), color: "text-neutral-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 text-sm font-medium text-neutral-700">
              Time by Issue
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th
                    className="text-left px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => handleSort("key")}
                  >
                    Issue {sortKey === "key" ? (sortAsc ? "↑" : "↓") : ""}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => handleSort("title")}
                  >
                    Title {sortKey === "title" ? (sortAsc ? "↑" : "↓") : ""}
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => handleSort("assigneeName")}
                  >
                    Assignee {sortKey === "assigneeName" ? (sortAsc ? "↑" : "↓") : ""}
                  </th>
                  <SortTh col="estimateMinutes" label="Est (h)" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  <SortTh col="loggedMinutes" label="Logged (h)" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                  <SortTh col="delta" label="Δ" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((issue, i) => {
                  const delta = issue.loggedMinutes - issue.estimateMinutes;
                  return (
                    <tr key={issue.id} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">{issue.key}</td>
                      <td className="px-4 py-3 text-neutral-800 max-w-xs truncate">{issue.title}</td>
                      <td className="px-4 py-3 text-neutral-600">{issue.assigneeName}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{fmtH(issue.estimateMinutes)}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{fmtH(issue.loggedMinutes)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          delta > 0 ? "text-red-600" : delta < 0 ? "text-green-600" : "text-neutral-400"
                        }`}
                      >
                        {delta === 0 ? "—" : fmtDelta(delta)}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-400 text-sm">
                      No issues in this sprint.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {memberEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="text-sm font-medium text-neutral-700 mb-4">Time by Member</div>
              <div className="space-y-3">
                {memberEntries.map(([name, min]) => (
                  <div key={name} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate text-neutral-700 text-right text-xs">{name}</span>
                    <div className="flex-1 h-5 bg-neutral-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded transition-all"
                        style={{ width: `${(min / maxMemberMin) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs text-neutral-600 shrink-0">{fmtH(min)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
