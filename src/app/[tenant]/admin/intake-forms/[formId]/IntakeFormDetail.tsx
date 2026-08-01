"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  addIntakeFormFieldAction, deleteIntakeFormFieldAction, convertIntakeSubmissionAction, dismissIntakeSubmissionAction,
} from "../actions";

type FieldType = "text" | "textarea" | "select";
type Field = { id: string; label: string; type: FieldType; options: string[]; required: boolean };
type Submission = {
  id: string; summary: string; answers: Record<string, string>; submitterEmail: string | null;
  status: "new" | "converted" | "dismissed"; convertedIssueId: string | null; createdAt: string;
};

export default function IntakeFormDetail({
  slug, formId, formName, readOnly, canManageFields, fields, submissions: initialSubmissions,
}: {
  slug: string; formId: string; formName: string; readOnly: boolean; canManageFields: boolean;
  fields: Field[]; submissions: Submission[];
}) {
  const [tab, setTab] = useState<"submissions" | "fields">("submissions");
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [convertedIssueId, setConvertedIssueId] = useState<string | null>(null);

  const fieldMap = new Map(fields.map((f) => [f.id, f.label]));
  const newCount = submissions.filter((s) => s.status === "new").length;

  function convert(submissionId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const issueId = await convertIntakeSubmissionAction(slug, formId, submissionId);
        setSubmissions((s) => s.map((x) => (x.id === submissionId ? { ...x, status: "converted", convertedIssueId: issueId } : x)));
        setConvertedIssueId(issueId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to convert");
      }
    });
  }

  function dismiss(submissionId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await dismissIntakeSubmissionAction(slug, formId, submissionId);
        setSubmissions((s) => s.map((x) => (x.id === submissionId ? { ...x, status: "dismissed" } : x)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to dismiss");
      }
    });
  }

  return (
    <div className={readOnly ? "pointer-events-none opacity-70" : ""}>
      <Link href={`/${slug}/admin/intake-forms`} className="text-xs text-neutral-400 hover:text-neutral-600">← All intake forms</Link>
      <h2 className="mt-1 text-base font-semibold text-neutral-900">{formName}</h2>

      <div className="mt-4 flex rounded-lg border border-neutral-200 bg-white p-0.5 w-fit">
        <button onClick={() => setTab("submissions")} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === "submissions" ? "bg-[#b7452f] text-white" : "text-neutral-500 hover:text-neutral-700"}`}>
          Submissions {newCount > 0 && `(${newCount} new)`}
        </button>
        <button onClick={() => setTab("fields")} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === "fields" ? "bg-[#b7452f] text-white" : "text-neutral-500 hover:text-neutral-700"}`}>
          Fields
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {convertedIssueId && (
        <p className="mt-3 rounded-lg bg-[#e9f3ea] px-3 py-2 text-sm text-[#3f7d4c]">
          Converted → <Link href={`/${slug}/issues/${convertedIssueId}`} className="underline font-medium">view issue</Link>
        </p>
      )}

      {tab === "submissions" ? (
        <div className="mt-4 space-y-2">
          {submissions.length === 0 && <p className="text-sm text-neutral-400">No submissions yet.</p>}
          {submissions.map((s) => (
            <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-neutral-900">{s.summary}</p>
                  <p className="text-xs text-neutral-400">{new Date(s.createdAt).toLocaleString()}{s.submitterEmail ? ` · ${s.submitterEmail}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  s.status === "new" ? "bg-[#eaf1f8] text-[#3a6ea8]" : s.status === "converted" ? "bg-[#e9f3ea] text-[#3f7d4c]" : "bg-neutral-100 text-neutral-500"
                }`}>
                  {s.status}
                </span>
              </div>
              {Object.entries(s.answers).filter(([, v]) => v).length > 0 && (
                <dl className="mt-2 space-y-1 border-t border-neutral-100 pt-2 text-sm">
                  {Object.entries(s.answers).filter(([, v]) => v).map(([fieldId, value]) => (
                    <div key={fieldId} className="flex gap-2">
                      <dt className="shrink-0 font-medium text-neutral-500">{fieldMap.get(fieldId) ?? fieldId}:</dt>
                      <dd className="text-neutral-700">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {s.status === "converted" && s.convertedIssueId && (
                <Link href={`/${slug}/issues/${s.convertedIssueId}`} className="mt-2 inline-block text-xs font-medium text-[#b7452f] hover:underline">View issue →</Link>
              )}
              {s.status === "new" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => convert(s.id)} disabled={pending} className="rounded-lg bg-[#b7452f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#8c4632] disabled:opacity-50">
                    Convert to issue
                  </button>
                  <button onClick={() => dismiss(s.id)} disabled={pending} className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <FieldsEditor slug={slug} formId={formId} fields={fields} readOnly={!canManageFields} />
      )}
    </div>
  );
}

function FieldsEditor({ slug, formId, fields: initialFields, readOnly }: { slug: string; formId: string; fields: Field[]; readOnly: boolean }) {
  const [fields, setFields] = useState(initialFields);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!label.trim()) return;
    setError(null);
    const options = type === "select" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : [];
    startTransition(async () => {
      try {
        await addIntakeFormFieldAction(slug, formId, { label: label.trim(), type, options, required });
        setFields((f) => [...f, { id: crypto.randomUUID(), label: label.trim(), type, options, required }]);
        setLabel(""); setOptionsText(""); setRequired(false); setType("text");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add field");
      }
    });
  }

  function remove(fieldId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteIntakeFormFieldAction(slug, formId, fieldId);
        setFields((f) => f.filter((x) => x.id !== fieldId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove field");
      }
    });
  }

  return (
    <div className={`mt-4 rounded-xl border border-neutral-200 bg-white p-4 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      <p className="mb-3 text-xs text-neutral-500">
        Every submission always collects a required &quot;Summary&quot; (used as the issue title) and an optional contact email — these fields below are additional, form-specific questions.
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Field label" className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
        <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          <option value="text">Text</option>
          <option value="textarea">Long text</option>
          <option value="select">Select</option>
        </select>
        {type === "select" && (
          <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Options (comma-separated)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
        )}
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
        </label>
        <button onClick={add} disabled={pending || !label.trim()} className="rounded-lg bg-[#b7452f] px-3 py-2 text-sm font-medium text-white hover:bg-[#8c4632] disabled:opacity-40">
          Add field
        </button>
      </div>

      <ul className="space-y-1.5">
        {fields.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 text-sm">
            <span className="text-neutral-800">
              {f.label} <span className="text-xs text-neutral-400">· {f.type}{f.required ? " · required" : ""}{f.type === "select" && f.options.length ? ` · ${f.options.join("/")}` : ""}</span>
            </span>
            <button onClick={() => remove(f.id)} className="text-xs text-red-600 hover:underline">Delete</button>
          </li>
        ))}
        {fields.length === 0 && <li className="text-sm text-neutral-400">No custom fields yet — submitters will only see Summary and email.</li>}
      </ul>
    </div>
  );
}
