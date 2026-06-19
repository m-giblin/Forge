"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeStatusAction, deleteProjectAction } from "./actions";
import type { ProjectStatus } from "@/lib/repositories/projects";

export const STATUS_META: Record<ProjectStatus, { label: string; cls: string }> = {
  active:   { label: "Active",   cls: "bg-emerald-100 text-emerald-700" },
  on_hold:  { label: "On hold",  cls: "bg-amber-100 text-amber-700" },
  closed:   { label: "Closed",   cls: "bg-neutral-200 text-neutral-600" },
  archived: { label: "Archived", cls: "bg-purple-100 text-purple-700" },
};

const ALL_STATUSES: ProjectStatus[] = ["active", "on_hold", "closed", "archived"];

export function ProjectStatusBadge({
  slug,
  projectKey,
  status,
  isAdmin,
}: {
  slug: string;
  projectKey: string;
  status: ProjectStatus;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const meta = STATUS_META[status];

  function change(next: ProjectStatus) {
    setOpen(false);
    if (next === status) return;
    startTransition(() => changeStatusAction(slug, projectKey, next));
  }

  if (!isAdmin) {
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-50 ${meta.cls}`}
      >
        {pending ? "Saving…" : meta.label + " ▾"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => change(s)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-50 ${s === status ? "font-semibold" : ""}`}
              >
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[s].cls}`}>
                  {STATUS_META[s].label}
                </span>
                {s === status && <span className="ml-auto text-neutral-400">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProjectDangerZone({
  slug,
  projectKey,
  issueCount,
}: {
  slug: string;
  projectKey: string;
  issueCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canDelete = issueCount === 0;

  function handleDelete() {
    if (!confirm(`Permanently delete project ${projectKey}? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteProjectAction(slug, projectKey);
        router.push(`/${slug}/projects`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
      }
    });
  }

  return (
    <div className="mt-10 rounded-xl border border-red-200 bg-red-50 p-5">
      <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-red-700">Delete project</p>
          {canDelete ? (
            <p className="mt-0.5 text-xs text-red-500">
              No issues — permanently removes this project and all its data.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-red-500">
              This project has {issueCount} issue{issueCount === 1 ? "" : "s"}. Archive it instead of deleting.
            </p>
          )}
        </div>
        <button
          onClick={handleDelete}
          disabled={!canDelete || pending}
          className="shrink-0 rounded-lg border border-red-400 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete project"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
