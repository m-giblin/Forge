"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Project, ProjectStatus } from "@/lib/repositories/projects";
import { STATUS_META } from "./projects/[key]/ProjectStatusControl";
import { createProjectAction, applyProjectTemplateAction } from "./actions";
import { PROJECT_TEMPLATES, type TemplateKey } from "@/lib/projectTemplates";
import PageHeader from "@/components/patterns/PageHeader";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";

type OwnerOption = { userId: string; label: string };

export type ProjectStats = { total: number; done: number; blocked: number; members: number };

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

/** Status pill colors — reuse the shared status palette (no amber; STATUS_META's
 *  own `cls` is ignored here since it's amber for on_hold in the shared file). */
const PROJECT_STATUS_COLOR: Record<ProjectStatus, { fg: string; bg: string }> = {
  active:   { fg: "#3f7d4c", bg: "#e9f3ea" },
  on_hold:  { fg: "#c9791d", bg: "#fdf1de" },
  closed:   { fg: "#a19d90", bg: "#f1efe9" },
  archived: { fg: "#7a4fa0", bg: "#f4ecfa" },
};

/** Blocked-count health signal, shown as the top-right pill. */
function issueHealth(blocked: number) {
  if (blocked > 2) return { label: "At risk", fg: "#c0392b", bg: "#fbeae8" };
  if (blocked > 0) return { label: "Needs attention", fg: "#c9791d", bg: "#fdf1de" };
  return { label: "Healthy", fg: "#3f7d4c", bg: "#e9f3ea" };
}

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function ProjectCard({ slug, p, stats }: { slug: string; p: Project; stats?: ProjectStats }) {
  const statusMeta = STATUS_META[p.status];
  const statusColor = PROJECT_STATUS_COLOR[p.status];
  const health = stats ? issueHealth(stats.blocked) : null;
  const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const barColor = pct >= 75 ? "#3f7d4c" : pct >= 40 ? "#3a6ea8" : "#b7452f";
  return (
    <Link
      href={`/${slug}/projects/${p.key}`}
      className="fw-card block px-[18px] py-4 transition hover:border-[#c3bda9]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[#5e2c1f] text-[11px] font-extrabold text-[#f2e9d8]"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
          >
            {initialsOf(p.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-[#20201d]">{p.name}</p>
            <p className="font-mono text-[11px] text-[#a19d90]">{p.key}</p>
          </div>
        </div>
        {health ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ color: health.fg, backgroundColor: health.bg }}
          >
            {health.label}
          </span>
        ) : (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ color: statusColor.fg, backgroundColor: statusColor.bg }}
          >
            {statusMeta.label}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[12px] text-[#726e60]">
        Start {fmtDate(p.start_date)} · Go-live {fmtDate(p.target_go_live)}
      </p>

      {stats && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ddd8c9]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-[#726e60]">
              <span className="font-bold text-[#20201d]">{stats.done}</span>/{stats.total} done
            </span>
            {stats.blocked > 0 && (
              <span className="text-[11px] text-[#c0392b]">{stats.blocked} blocked</span>
            )}
            <span className="ml-auto text-[11px] text-[#a19d90]">
              {stats.members} member{stats.members === 1 ? "" : "s"}
            </span>
          </div>
        </>
      )}
    </Link>
  );
}

export default function ProjectsLanding({
  slug,
  isAdmin = false,
  canCreate,
  projects,
  archivedProjects = [],
  members,
  stats = {},
}: {
  slug: string;
  isAdmin?: boolean;
  canCreate: boolean;
  projects: Project[];
  archivedProjects?: Project[];
  members: OwnerOption[];
  stats?: Record<string, ProjectStats>;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [showArchive, setShowArchive] = useState(false);

  const visible = filter === "all"
    ? projects
    : projects.filter((p) => p.status === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Projects"
        subtitle="Every project in this workspace, with health and progress"
        right={
          canCreate ? (
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="rounded-[5px] border border-[#5e2c1f] px-[13px] py-[7px] text-[12px] font-bold text-[#f2e9d8]"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              {showForm ? "Cancel" : "+ New project"}
            </button>
          ) : undefined
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[18px] pb-7">
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
          <FilterRow>
            {FILTER_OPTIONS.map((o) => (
              <FilterPill key={o.value} active={filter === o.value} onClick={() => setFilter(o.value)}>
                {o.label}
                {o.value !== "all" && ` (${projects.filter((p) => p.status === o.value).length})`}
              </FilterPill>
            ))}
          </FilterRow>
        )}

        {visible.length === 0 ? (
          <div className="fw-card mt-4 p-10 text-center text-[13px] text-[#726e60]">
            {projects.length === 0
              ? canCreate
                ? "No projects yet. Create one to start filing issues."
                : "You’re not on any project teams yet. An admin can add you to a project."
              : `No ${filter === "all" ? "" : filter.replace("_", " ")} projects.`}
          </div>
        ) : (
          <div className="mt-4 grid max-w-[1200px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
            {visible.map((p) => (
              <ProjectCard key={p.id} slug={slug} p={p} stats={stats[p.id]} />
            ))}
          </div>
        )}

        {/* Archive section — admin only */}
        {isAdmin && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowArchive((s) => !s)}
              className="flex items-center gap-1.5 text-[12.5px] text-[#a19d90] hover:text-[#4a473e]"
            >
              <span>{showArchive ? "▾" : "▸"}</span>
              Archive
              {archivedProjects.length > 0 && (
                <span className="rounded-full bg-[#eae6da] px-2 py-0.5 text-[11px] text-[#726e60]">
                  {archivedProjects.length}
                </span>
              )}
            </button>
            {showArchive && (
              archivedProjects.length === 0 ? (
                <p className="mt-3 text-[12.5px] text-[#a19d90]">No archived projects.</p>
              ) : (
                <div className="mt-3 grid max-w-[1200px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
                  {archivedProjects.map((p) => (
                    <ProjectCard key={p.id} slug={slug} p={p} />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
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
  const [templateKey, setTemplateKey] = useState<TemplateKey>("blank");
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
        if (templateKey !== "blank") {
          await applyProjectTemplateAction(slug, createdKey, templateKey);
        }
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
      {/* Template picker */}
      <div className="mb-5">
        <p className="text-xs font-medium text-neutral-600 mb-2">Start from a template</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROJECT_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTemplateKey(t.key)}
              className={`rounded-lg border p-3 text-left transition ${
                templateKey === t.key
                  ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                  : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <div className="text-lg">{t.icon}</div>
              <div className="mt-1 text-xs font-semibold text-neutral-900">{t.label}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500 leading-tight">{t.description}</div>
            </button>
          ))}
        </div>
      </div>
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
          className="rounded-[6px] border border-[#5e2c1f] px-4 py-2 text-sm font-medium text-[#f2e9d8] disabled:opacity-50"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
