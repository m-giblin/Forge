"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Project, ProjectStatus } from "@/lib/repositories/projects";
import { STATUS_META } from "./projects/[key]/ProjectStatusControl";
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

type StatusFilter = ProjectStatus | "all";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active",  label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "closed",  label: "Closed" },
  { value: "all",     label: "All" },
];

function ProjectCard({ slug, p }: { slug: string; p: Project }) {
  const chip = goLiveChip(p.target_go_live);
  const statusMeta = STATUS_META[p.status];
  return (
    <Link
      href={`/${slug}/projects/${p.key}`}
      className="block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">{p.key}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.cls}`}>{statusMeta.label}</span>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chip.cls}`}>{chip.text}</span>
      </div>
      <p className="mt-2 font-medium text-neutral-900">{p.name}</p>
      <p className="mt-2 text-xs text-neutral-400">
        Start {fmtDate(p.start_date)} · Go-live {fmtDate(p.target_go_live)}
      </p>
    </Link>
  );
}

export default function ProjectsLanding({
  slug,
  tenantName,
  isAdmin = false,
  canCreate,
  projects,
  archivedProjects = [],
  members,
}: {
  slug: string;
  tenantName: string;
  isAdmin?: boolean;
  canCreate: boolean;
  projects: Project[];
  archivedProjects?: Project[];
  members: OwnerOption[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [showArchive, setShowArchive] = useState(false);

  const visible = filter === "all"
    ? projects
    : projects.filter((p) => p.status === filter);

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
            router.push(`/${slug}/projects/${key}`);
          }}
        />
      )}

      {/* Status filter pills */}
      {projects.length > 0 && (
        <div className="mt-5 flex gap-2">
          {FILTER_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setFilter(o.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === o.value
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {o.label}
              {o.value !== "all" && (
                <span className="ml-1 opacity-60">
                  ({projects.filter((p) => p.status === o.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          {projects.length === 0
            ? canCreate
              ? "No projects yet. Create one to start filing issues."
              : "You’re not on any project teams yet. An admin can add you to a project."
            : `No ${filter === "all" ? "" : filter.replace("_", " ")} projects.`}
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((p) => (
            <li key={p.id}>
              <ProjectCard slug={slug} p={p} />
            </li>
          ))}
        </ul>
      )}

      {/* Archive section — admin only */}
      {isAdmin && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchive((s) => !s)}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-600"
          >
            <span>{showArchive ? "▾" : "▸"}</span>
            Archive
            {archivedProjects.length > 0 && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {archivedProjects.length}
              </span>
            )}
          </button>
          {showArchive && (
            archivedProjects.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400">No archived projects.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {archivedProjects.map((p) => (
                  <li key={p.id}>
                    <ProjectCard slug={slug} p={p} />
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
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
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
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
          description: description || null,
          status,
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
        <div className="sm:col-span-2">
          <label className={label}>Description <span className="text-neutral-400">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project for? What will it deliver?"
            rows={2}
            className={`${field} resize-none`}
          />
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
          <label className={label}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="closed">Closed</option>
          </select>
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
