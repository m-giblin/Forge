"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type Issue } from "@/lib/repositories/issues";
import { type FieldOption, type CustomField } from "@/lib/repositories/fieldConfig";

type Project = { id: string; key: string; name: string };

export default function IssuesTable({
  slug,
  issues,
  projects,
  statuses,
  priorities,
  types,
  customFields = [],
}: {
  slug: string;
  issues: Issue[];
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  customFields?: CustomField[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");

  const projectKey = (id: string) => projects.find((p) => p.id === id)?.key ?? "—";
  const statusLabel = (k: string) => statuses.find((o) => o.key === k)?.label ?? k;
  const prMap = useMemo(() => new Map(priorities.map((o) => [o.key, o])), [priorities]);
  const tyMap = useMemo(() => new Map(types.map((o) => [o.key, o])), [types]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return issues
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => (priority === "all" ? true : i.priority === priority))
      .filter((i) => (needle ? i.title.toLowerCase().includes(needle) : true))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [issues, q, status, priority]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold text-neutral-900">
          Issues <span className="text-sm font-normal text-neutral-400">({filtered.length})</span>
        </h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title…"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="all">All statuses</option>
          {[...statuses].sort((a, b) => a.position - b.position).map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="all">All priorities</option>
          {priorities.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              {customFields.map((f) => (
                <th key={f.id} className="px-4 py-2.5 font-medium">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const ty = tyMap.get(i.type);
              const pr = prMap.get(i.priority);
              return (
                <tr
                  key={i.id}
                  onClick={() => router.push(`/${slug}/issues/${i.id}`)}
                  className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-neutral-400">
                    {projectKey(i.project_id)}-{i.number}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-800">{i.title}</td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    <span style={{ color: ty?.color ?? undefined }}>{ty?.label ?? i.type}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-neutral-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pr?.color ?? "#9CA3AF" }} />
                      {pr?.label ?? i.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{statusLabel(i.status)}</td>
                  {customFields.map((f) => (
                    <td key={f.id} className="px-4 py-2.5 text-neutral-600">
                      {String((i.custom_values ?? {})[f.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5 + customFields.length} className="px-4 py-10 text-center text-sm text-neutral-400">
                  No issues match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
