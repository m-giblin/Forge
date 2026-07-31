"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createIntakeFormAction, regenerateIntakeFormLinkAction, setIntakeFormActiveAction, deleteIntakeFormAction,
} from "./actions";

type Project = { id: string; key: string; name: string };
type Form = { id: string; name: string; description: string | null; projectId: string; isActive: boolean };

export default function IntakeFormsManager({
  slug, readOnly, forms: initialForms, projects,
}: {
  slug: string; readOnly: boolean; forms: Form[]; projects: Project[];
}) {
  const [forms, setForms] = useState(initialForms);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [freshUrls, setFreshUrls] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProject, setNewProject] = useState(projects[0]?.id ?? "");

  function createForm() {
    if (!newName.trim() || !newProject) return;
    setError(null);
    startTransition(async () => {
      try {
        const { id, url } = await createIntakeFormAction(slug, newName.trim(), newDesc.trim(), newProject);
        setForms((f) => [{ id, name: newName.trim(), description: newDesc.trim() || null, projectId: newProject, isActive: true }, ...f]);
        setFreshUrls((u) => ({ ...u, [id]: url }));
        setNewName(""); setNewDesc(""); setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create form");
      }
    });
  }

  function regenerate(formId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const url = await regenerateIntakeFormLinkAction(slug, formId);
        setFreshUrls((u) => ({ ...u, [formId]: url }));
        setForms((f) => f.map((x) => (x.id === formId ? { ...x, isActive: true } : x)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to regenerate link");
      }
    });
  }

  function toggleActive(formId: string, next: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setIntakeFormActiveAction(slug, formId, next);
        setForms((f) => f.map((x) => (x.id === formId ? { ...x, isActive: next } : x)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update form");
      }
    });
  }

  function remove(formId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteIntakeFormAction(slug, formId);
        setForms((f) => f.filter((x) => x.id !== formId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete form");
      }
    });
  }

  function copy(id: string, url: string) {
    navigator.clipboard.writeText(url).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); });
  }

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className={`mt-6 space-y-4 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
        >
          + New intake form
        </button>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">New intake form</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Name</label>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Customer Bug Reports" className="w-56 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Target project</label>
              <select value={newProject} onChange={(e) => setNewProject(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-neutral-500">Description shown to submitters (optional)</label>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this form for?" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={createForm} disabled={pending || !newName.trim() || !newProject} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
              Create form
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Cancel</button>
          </div>
        </div>
      )}

      {forms.length === 0 && !showForm && <p className="text-sm text-neutral-400">No intake forms yet.</p>}

      {forms.map((f) => {
        const freshUrl = freshUrls[f.id];
        return (
          <div key={f.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-900">{f.name}</span>
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{projectMap.get(f.projectId)?.key ?? "?"}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${f.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                {f.isActive ? "Active" : "Paused"}
              </span>
            </div>
            {f.description && <p className="mt-1 text-xs text-neutral-500">{f.description}</p>}

            {freshUrl && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-amber-800">Copy this now — for security it won&apos;t be shown again. Regenerate if you lose it.</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input readOnly value={freshUrl} onFocus={(e) => e.target.select()} className="flex-1 rounded border border-amber-300 bg-white px-2 py-1 font-mono text-xs text-neutral-700" />
                  <button onClick={() => copy(f.id, freshUrl)} className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800">
                    {copiedId === f.id ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/${slug}/admin/intake-forms/${f.id}`} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                Fields &amp; submissions →
              </Link>
              {!readOnly && (
                <>
                  <button onClick={() => regenerate(f.id)} disabled={pending} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                    {freshUrl ? "Regenerate" : "Get link"}
                  </button>
                  <button onClick={() => toggleActive(f.id, !f.isActive)} disabled={pending} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                    {f.isActive ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => remove(f.id)} disabled={pending} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
