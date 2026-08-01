"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createIntakeFormAction, regenerateIntakeFormLinkAction, setIntakeFormActiveAction, deleteIntakeFormAction,
} from "./actions";
import FormGrid from "@/components/patterns/admin/FormGrid";
import Note from "@/components/patterns/admin/Note";

type Project = { id: string; key: string; name: string };
type Form = { id: string; name: string; description: string | null; projectId: string; isActive: boolean };

const inputClass =
  "rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]";

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
    <div className={`space-y-4 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      {error && <Note icon="!" tone="error">{error}</Note>}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-[5px] border border-dashed border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[11.5px] font-semibold text-[#726e60] hover:border-[#b7452f]/40 hover:text-[#4a473e]"
        >
          + New intake form
        </button>
      ) : (
        <FormGrid
          fields={[
            {
              key: "name",
              label: "Form name",
              input: (
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Customer Bug Reports" className={inputClass} />
              ),
            },
            {
              key: "project",
              label: "Target project",
              input: (
                <select value={newProject} onChange={(e) => setNewProject(e.target.value)} className={inputClass}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ),
            },
            {
              key: "description",
              label: "Description",
              input: (
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this form for?"
                  rows={3}
                  className={`${inputClass} resize-none md:col-span-2`}
                />
              ),
            },
          ]}
          onCancel={() => setShowForm(false)}
          onSubmit={createForm}
          submitLabel={pending ? "Creating…" : "Create form"}
        />
      )}

      {forms.length === 0 && !showForm && <p className="text-[11.5px] text-[#a19d90]">No intake forms yet.</p>}

      {forms.length > 0 && (
        <div className="fw-card overflow-hidden">
          {forms.map((f, i) => {
            const freshUrl = freshUrls[f.id];
            const project = projectMap.get(f.projectId);
            return (
              <div key={f.id} className={`px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-[#20201d]">{f.name}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-[#726e60]">
                      {project?.name ?? "?"} · {f.isActive ? "public link active" : "draft"}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-[3px] text-[11px] font-semibold"
                    style={f.isActive ? { color: "#3f6b43", backgroundColor: "#e3ecdf" } : { color: "#726e60", backgroundColor: "#f1efe9" }}
                  >
                    {f.isActive ? "Active" : "Paused"}
                  </span>
                  <Link href={`/${slug}/admin/intake-forms/${f.id}`} className="shrink-0 text-[11.5px] font-semibold text-[#b7452f] hover:underline">
                    Open
                  </Link>
                </div>

                {f.description && <p className="mt-1.5 text-[11.5px] text-[#726e60]">{f.description}</p>}

                {freshUrl && (
                  <div className="mt-2.5 rounded-[6px] border border-[#f0dcb8] bg-[#fdf1de] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#c9791d]">Copy this now — for security it won&apos;t be shown again. Regenerate if you lose it.</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input readOnly value={freshUrl} onFocus={(e) => e.target.select()} className="flex-1 rounded-[4px] border border-[#f0dcb8] bg-white px-2 py-1 font-mono text-[11px] text-[#4a473e]" />
                      <button onClick={() => copy(f.id, freshUrl)} className="shrink-0 rounded-[4px] bg-[#20201d] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#3a3a35]">
                        {copiedId === f.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {!readOnly && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button onClick={() => regenerate(f.id)} disabled={pending} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1 text-[11px] font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-50">
                      {freshUrl ? "Regenerate" : "Get link"}
                    </button>
                    <button onClick={() => toggleActive(f.id, !f.isActive)} disabled={pending} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1 text-[11px] font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-50">
                      {f.isActive ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => remove(f.id)} disabled={pending} className="rounded-[5px] px-2.5 py-1 text-[11px] font-semibold text-[#a13a2f] hover:bg-[#f5e3df] disabled:opacity-50">
                      Delete
                    </button>
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
