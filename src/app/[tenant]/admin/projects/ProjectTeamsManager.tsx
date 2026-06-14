"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProjectMemberAction, removeProjectMemberAction } from "./actions";
import { createProjectAction } from "@/app/[tenant]/actions";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };

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

export default function ProjectTeamsManager({
  slug,
  readOnly,
  projects: initialProjects,
  members,
  teamMap: initialTeamMap,
}: {
  slug: string;
  readOnly: boolean;
  projects: Project[];
  members: Member[];
  teamMap: Record<string, string[]>;
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<Record<string, string[]>>(initialTeamMap);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // New project form state
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newGoLive, setNewGoLive] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  const labelFor = (id: string) => members.find((m) => m.userId === id)?.label ?? "—";

  function handleNameChange(v: string) {
    setNewName(v);
    if (!newKey || newKey === deriveKey(newName)) setNewKey(deriveKey(v));
  }

  function submitNewProject() {
    if (!newName.trim()) return;
    setFormError(null);
    startCreate(async () => {
      try {
        await createProjectAction(slug, {
          name: newName.trim(),
          key: newKey.trim() || null,
          ownerUserId: newOwner || null,
          startDate: newStart || null,
          targetGoLive: newGoLive || null,
        });
        setNewName(""); setNewKey(""); setNewOwner(""); setNewStart(""); setNewGoLive("");
        setShowForm(false);
        router.refresh();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Failed to create project");
      }
    });
  }

  function add(projectId: string, userId: string) {
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addProjectMemberAction(slug, projectId, userId);
        setTeams((t) => ({ ...t, [projectId]: [...new Set([...(t[projectId] ?? []), userId])] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add");
      }
    });
  }

  function remove(projectId: string, userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeProjectMemberAction(slug, projectId, userId);
        setTeams((t) => ({ ...t, [projectId]: (t[projectId] ?? []).filter((u) => u !== userId) }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  }

  return (
    <div className="mt-5 space-y-4">

      {/* New project button / form */}
      {!readOnly && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
            >
              + New project
            </button>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">New project</h3>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Project name <span className="text-red-500">*</span></label>
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitNewProject()}
                    placeholder="e.g. Mobile App"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Key <span className="text-neutral-400">(auto)</span></label>
                  <input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    placeholder="MOB"
                    className="w-24 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Owner</label>
                  <select
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
                  >
                    <option value="">— none —</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Start date</label>
                  <input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Target go-live</label>
                  <input
                    type="date"
                    value={newGoLive}
                    onChange={(e) => setNewGoLive(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
              {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={submitNewProject}
                  disabled={creating || !newName.trim()}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create project"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setFormError(null); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {initialProjects.length === 0 && !showForm && (
        <p className="text-sm text-neutral-400">No projects yet — create one above.</p>
      )}

      {/* Project team cards */}
      {initialProjects.map((p) => {
        const team = teams[p.id] ?? [];
        const available = members.filter((m) => !team.includes(m.userId));
        return (
          <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">{p.key}</span>
              <span className="font-medium text-neutral-900">{p.name}</span>
              <span className="ml-auto text-xs text-neutral-400">{team.length} member{team.length === 1 ? "" : "s"}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {team.length === 0 && <span className="text-xs text-neutral-400">No one assigned yet.</span>}
              {team.map((uid) => (
                <span key={uid} className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                  {labelFor(uid)}
                  {!readOnly && (
                    <button
                      onClick={() => remove(p.id, uid)}
                      disabled={pending}
                      className="text-neutral-400 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Remove ${labelFor(uid)}`}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>

            {!readOnly && available.length > 0 && (
              <div className="mt-3">
                <select
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => { add(p.id, e.target.value); e.target.value = ""; }}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                >
                  <option value="" disabled>+ Add person…</option>
                  {available.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
