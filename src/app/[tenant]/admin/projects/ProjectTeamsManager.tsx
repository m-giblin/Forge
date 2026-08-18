"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProjectMemberAction, removeProjectMemberAction, deleteProjectAction, setDefaultProjectAction } from "./actions";
import { createProjectAction } from "@/app/[tenant]/actions";
import FormGrid from "@/components/patterns/admin/FormGrid";

type Project = { id: string; key: string; name: string };
type Member = { userId: string; label: string };

const inputClass =
  "rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]";

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
  defaultProjectId,
}: {
  slug: string;
  readOnly: boolean;
  projects: Project[];
  members: Member[];
  teamMap: Record<string, string[]>;
  defaultProjectId: string | null;
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<Record<string, string[]>>(initialTeamMap);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(defaultProjectId);
  const [defaultPending, startDefaultTransition] = useTransition();

  function toggleDefault(projectId: string) {
    setError(null);
    const next = defaultId === projectId ? null : projectId;
    startDefaultTransition(async () => {
      try {
        await setDefaultProjectAction(slug, next);
        setDefaultId(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to set default project");
      }
    });
  }

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
    <div className="space-y-4">
      {/* New project trigger / form */}
      {!readOnly && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-[5px] border border-dashed border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[11.5px] font-semibold text-[#726e60] hover:border-[#b7452f]/40 hover:text-[#4a473e]"
            >
              + New project
            </button>
          ) : (
            <FormGrid
              fields={[
                {
                  key: "name",
                  label: "Project name *",
                  input: (
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitNewProject()}
                      placeholder="e.g. Mobile App"
                      className={inputClass}
                    />
                  ),
                },
                {
                  key: "key",
                  label: "Key (auto)",
                  input: (
                    <input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                      placeholder="MOB"
                      className={`${inputClass} font-mono uppercase`}
                    />
                  ),
                },
                {
                  key: "owner",
                  label: "Owner",
                  input: (
                    <select value={newOwner} onChange={(e) => setNewOwner(e.target.value)} className={inputClass}>
                      <option value="">— none —</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.label}</option>
                      ))}
                    </select>
                  ),
                },
                {
                  key: "start",
                  label: "Start date",
                  input: (
                    <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} className={inputClass} />
                  ),
                },
                {
                  key: "golive",
                  label: "Target go-live",
                  input: (
                    <input type="date" value={newGoLive} onChange={(e) => setNewGoLive(e.target.value)} className={inputClass} />
                  ),
                },
              ]}
              onCancel={() => { setShowForm(false); setFormError(null); }}
              onSubmit={submitNewProject}
              submitLabel={creating ? "Creating…" : "Create project"}
            />
          )}
          {formError && <p className="mt-2 text-[11.5px] text-[#a13a2f]">{formError}</p>}
        </div>
      )}

      {error && <p className="text-[11.5px] text-[#a13a2f]">{error}</p>}

      {initialProjects.length === 0 && !showForm && (
        <p className="text-[11.5px] text-[#a19d90]">No projects yet — create one above.</p>
      )}

      {/* Project team cards */}
      {initialProjects.map((p) => {
        const team = teams[p.id] ?? [];
        const available = members.filter((m) => !team.includes(m.userId));
        return (
          <div key={p.id} className="fw-card p-3.5">
            <div className="flex items-center gap-2">
              <span className="rounded-[4px] bg-[#f1efe9] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#726e60]">{p.key}</span>
              <span className="text-[12.5px] font-semibold text-[#20201d]">{p.name}</span>
              {defaultId === p.id && (
                <span className="rounded-full bg-[#fdf1de] px-2 py-0.5 text-[10.5px] font-semibold text-[#c9791d]">Default</span>
              )}
              <span className="ml-auto text-[11px] text-[#a19d90]">
                {team.length} member{team.length === 1 ? "" : "s"}
              </span>
              {!readOnly && (
                <button
                  onClick={() => toggleDefault(p.id)}
                  disabled={defaultPending}
                  className={`rounded-[4px] px-2 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                    defaultId === p.id
                      ? "text-[#c9791d] hover:bg-[#fdf1de]"
                      : "text-[#a19d90] hover:bg-[#f1efe9] hover:text-[#4a473e]"
                  }`}
                  title={defaultId === p.id ? "Unset as default project" : "Open this project by default on the Sprint Board"}
                >
                  {defaultId === p.id ? "★ Default" : "Set as default"}
                </button>
              )}
              {!readOnly && (
                deletingId === p.id ? (
                  <div className="ml-2 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#a13a2f]">Delete this project and all its issues?</span>
                    <button
                      onClick={() => {
                        startTransition(async () => {
                          try { await deleteProjectAction(slug, p.id); router.refresh(); }
                          catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
                          finally { setDeletingId(null); }
                        });
                      }}
                      disabled={pending}
                      className="rounded-[4px] bg-[#a13a2f] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#8a3126] disabled:opacity-50"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="rounded-[4px] px-2 py-1 text-[11px] text-[#726e60] hover:bg-[#f1efe9]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(p.id)}
                    className="ml-2 rounded-[4px] px-2 py-1 text-[11px] text-[#a19d90] transition hover:bg-[#f5e3df] hover:text-[#a13a2f]"
                    title="Delete project"
                  >
                    Delete
                  </button>
                )
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {team.length === 0 && <span className="text-[11px] text-[#a19d90]">No one assigned yet.</span>}
              {team.map((uid) => (
                <span key={uid} className="flex items-center gap-1.5 rounded-full bg-[#f1efe9] px-2.5 py-1 text-[11px] text-[#4a473e]">
                  {labelFor(uid)}
                  {!readOnly && (
                    <button
                      onClick={() => remove(p.id, uid)}
                      disabled={pending}
                      className="text-[#a19d90] hover:text-[#a13a2f] disabled:opacity-40"
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
                  className={inputClass}
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
