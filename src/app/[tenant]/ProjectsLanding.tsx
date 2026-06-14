"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Project } from "@/lib/repositories/projects";
import { createProjectAction } from "./actions";

type OwnerOption = { userId: string; label: string };

/** Go-live status chip — "dates trigger everything", so surface it up front. */
function goLiveChip(target: string | null) {
  if (!target) return { text: "No go-live date", cls: "bg-neutral-100 text-neutral-500" };
  const days = Math.ceil((new Date(target + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `Overdue ${-days}d`, cls: "bg-red-100 text-red-700" };
  if (days === 0) return { text: "Go-live today", cls: "bg-amber-100 text-amber-700" };
  if (days <= 14) return { text: `Go-live in ${days}d`, cls: "bg-amber-100 text-amber-700" };
  return { text: `Go-live in ${days}d`, cls: "bg-emerald-100 text-emerald-700" };
}

function fmtDate(d: string | null) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export default function ProjectsLanding({
  slug,
  tenantName,
  canCreate,
  projects,
  members,
}: {
  slug: string;
  tenantName: string;
  canCreate: boolean;
  projects: Project[];
  members: OwnerOption[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{tenantName} projects</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Projects you can see. Open one to work its board.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {showForm ? "Cancel" : "+ New project"}
          </button>
        )}
      </div>

      {showForm && canCreate && (
        <NewProjectForm
          slug={slug}
          members={members}
          onDone={(key) => {
            setShowForm(false);
            router.push(`/${slug}/board?project=${key}`);
          }}
        />
      )}

      {projects.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          {canCreate
            ? "No projects yet. Create one to start filing issues."
            : "You’re not on any project teams yet. An admin can add you to a project."}
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const chip = goLiveChip(p.target_go_live);
            return (
              <li key={p.id}>
                <Link
                  href={`/${slug}/board?project=${p.key}`}
                  className="block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">
                      {p.key}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chip.cls}`}>{chip.text}</span>
                  </div>
                  <p className="mt-2 font-medium text-neutral-900">{p.name}</p>
                  <p className="mt-2 text-xs text-neutral-400">
                    Start {fmtDate(p.start_date)} · Go-live {fmtDate(p.target_go_live)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function deriveKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.slice(0, 3))
    .join("")
    .slice(0, 8);
}

function NewProjectForm({
  slug,
  members,
  onDone,
}: {
  slug: string;
  members: OwnerOption[];
  onDone: (key: string) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetGoLive, setTargetGoLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleNameChange(v: string) {
    setName(v);
    if (!key || key === deriveKey(name)) setKey(deriveKey(v));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { key: createdKey } = await createProjectAction(slug, {
          name,
          key: key || null,
          ownerUserId: ownerUserId || null,
          startDate: startDate || null,
          targetGoLive: targetGoLive || null,
        });
        onDone(createdKey);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create project");
      }
    });
  }

  const field = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";
  const label = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Project name</label>
          <input required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Website Redesign" className={field} />
        </div>
        <div>
          <label className={label}>Key <span className="text-neutral-400">(auto)</span></label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            placeholder="WEB"
            maxLength={8}
            className={`${field} font-mono`}
          />
        </div>
        <div>
          <label className={label}>Owner</label>
          <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={field}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>Expected go-live</label>
          <input type="date" value={targetGoLive} onChange={(e) => setTargetGoLive(e.target.value)} className={field} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
