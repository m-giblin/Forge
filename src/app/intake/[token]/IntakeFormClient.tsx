"use client";

import { useState, useTransition } from "react";
import { submitIntakeAction } from "./actions";

type Field = { id: string; label: string; type: "text" | "textarea" | "select"; options: string[]; required: boolean };

export default function IntakeFormClient({
  token, formName, formDescription, fields,
}: {
  token: string; formName: string; formDescription: string | null; fields: Field[];
}) {
  const [summary, setSummary] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!summary.trim()) { setError("Please describe what this is about."); return; }
    setError(null);
    startTransition(async () => {
      const result = await submitIntakeAction(token, summary, answers, email);
      if (result.ok) setSubmitted(true);
      else setError(result.error);
    });
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-emerald-800">Thanks — got it.</p>
          <p className="mt-1 text-sm text-emerald-700">Your submission has been sent to the team for review.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12">
      <div className="mx-auto max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-neutral-900">{formName}</h1>
        {formDescription && <p className="mt-1 text-sm text-neutral-500">{formDescription}</p>}

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">What&apos;s this about? <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short summary"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>

          {fields.map((f) => (
            <div key={f.id}>
              <label className="mb-1 block text-xs font-semibold text-neutral-600">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  value={answers[f.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 resize-none"
                />
              ) : f.type === "select" ? (
                <select
                  value={answers[f.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  value={answers[f.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                />
              )}
            </div>
          ))}

          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Your email (optional, in case we need to follow up)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={pending || !summary.trim()}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </main>
  );
}
