"use client";

import { useState, useEffect, useTransition } from "react";
import { generateReleaseNotesAction, getProjectsAction, type ReleaseNotes } from "./actions";

function Section({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">{icon} {title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-neutral-800">
            <span className="text-neutral-400 shrink-0 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toMarkdown(notes: ReleaseNotes): string {
  const lines: string[] = [
    `# Release Notes — ${notes.version}`,
    "",
    notes.summary,
    "",
  ];
  if (notes.features.length) {
    lines.push("## ✨ New Features", ...notes.features.map((f) => `- ${f}`), "");
  }
  if (notes.fixes.length) {
    lines.push("## 🐛 Bug Fixes", ...notes.fixes.map((f) => `- ${f}`), "");
  }
  if (notes.improvements.length) {
    lines.push("## 🔧 Improvements", ...notes.improvements.map((f) => `- ${f}`), "");
  }
  if (notes.breaking.length) {
    lines.push("## ⚠️ Breaking Changes", ...notes.breaking.map((f) => `- ${f}`), "");
  }
  lines.push("---");
  lines.push(`_Generated from ${notes.rawIssues.length} completed issues_`);
  return lines.join("\n");
}

export default function ReleaseNotesGenerator({ slug }: { slug: string }) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString().split("T")[0];

  const [projects, setProjects] = useState<Array<{ id: string; key: string; name: string }>>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(twoWeeksAgo);
  const [toDate, setToDate] = useState(today);
  const [notes, setNotes] = useState<ReleaseNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getProjectsAction(slug).then(setProjects).catch(() => null);
  }, [slug]);

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function generate() {
    setError(null);
    setNotes(null);
    startTransition(async () => {
      try {
        const result = await generateReleaseNotesAction(slug, fromDate, toDate, selectedProjects);
        setNotes(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
      }
    });
  }

  function copy() {
    if (!notes) return;
    navigator.clipboard.writeText(toMarkdown(notes)).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Config panel */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-5">
        {/* Date range */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">From date</label>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">To date</label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
          </div>
        </div>

        {/* Project filter */}
        {projects.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-2">Projects (all if none selected)</label>
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedProjects.includes(p.id)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {p.key} — {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generating…</>
          ) : (
            "✨ Generate release notes"
          )}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</p>
        )}
      </div>

      {/* Result */}
      {notes && (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50">
            <div>
              <p className="text-sm font-semibold text-neutral-800">Release Notes — {notes.version}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{notes.rawIssues.length} issues · {fromDate} to {toDate}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                {copied ? "✓ Copied!" : "Copy as Markdown"}
              </button>
              <button
                onClick={generate}
                disabled={isPending}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
              >
                Regenerate
              </button>
            </div>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Summary */}
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="text-sm text-indigo-900 leading-relaxed">{notes.summary}</p>
            </div>

            <Section title="New Features" items={notes.features} icon="✨" />
            <Section title="Bug Fixes" items={notes.fixes} icon="🐛" />
            <Section title="Improvements" items={notes.improvements} icon="🔧" />
            <Section title="Breaking Changes" items={notes.breaking} icon="⚠️" />

            {/* Source issues */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-neutral-400 hover:text-neutral-600 select-none">
                {notes.rawIssues.length} source issues ▸
              </summary>
              <div className="mt-2 space-y-1">
                {notes.rawIssues.map((i) => (
                  <div key={i.key} className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="font-mono text-neutral-400">{i.key}</span>
                    <span>{i.title}</span>
                    <span className="ml-auto text-neutral-300">{i.type}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
