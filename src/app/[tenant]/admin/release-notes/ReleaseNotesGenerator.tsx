"use client";

import { useState, useEffect, useTransition } from "react";
import { generateReleaseNotesAction, getProjectsAction, type ReleaseNotes } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import FormGrid from "@/components/patterns/admin/FormGrid";
import AdminList, { type AdminListItem } from "@/components/patterns/admin/AdminList";
import Note from "@/components/patterns/admin/Note";

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

  const draftItems: AdminListItem[] = notes
    ? ([
        notes.features.length > 0 && {
          key: "features",
          title: "✨ New Features",
          subline: notes.features.join(" · "),
          meta: `${notes.features.length}`,
        },
        notes.fixes.length > 0 && {
          key: "fixes",
          title: "🐛 Bug Fixes",
          subline: notes.fixes.join(" · "),
          meta: `${notes.fixes.length}`,
        },
        notes.improvements.length > 0 && {
          key: "improvements",
          title: "🔧 Improvements",
          subline: notes.improvements.join(" · "),
          meta: `${notes.improvements.length}`,
        },
        notes.breaking.length > 0 && {
          key: "breaking",
          title: "⚠️ Breaking Changes",
          subline: notes.breaking.join(" · "),
          meta: `${notes.breaking.length}`,
        },
      ].filter(Boolean) as AdminListItem[])
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Release Notes" subtitle="Draft a changelog entry from completed work" />

      <div className="space-y-6 px-6">
        <div>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Generate</h2>
          <FormGrid
            submitLabel={isPending ? "Generating…" : "Generate draft"}
            onSubmit={generate}
            fields={[
              {
                key: "from",
                label: "From date",
                input: (
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]"
                  />
                ),
              },
              {
                key: "to",
                label: "To date",
                input: (
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]"
                  />
                ),
              },
              {
                key: "projects",
                label: "Projects (all if none selected)",
                input: projects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProject(p.id)}
                        className={`rounded-[5px] border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                          selectedProjects.includes(p.id)
                            ? "border-[#8c4632] bg-[#f5e4dd] text-[#8c4632]"
                            : "border-[#ddd8c9] bg-white text-[#4a473e] hover:bg-[#f4f2eb]"
                        }`}
                      >
                        {p.key} — {p.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-[#a19d90]">No projects available</p>
                ),
              },
            ]}
          />
          {error && <p className="mt-2 text-[12px] font-medium text-[#a3372a]">{error}</p>}
        </div>

        {notes && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[12.5px] font-bold text-[#20201d]">Draft — {notes.version}</h2>
              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
                >
                  {copied ? "Copied ✓" : "Copy as Markdown"}
                </button>
                <button
                  onClick={generate}
                  disabled={isPending}
                  className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da] disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            </div>

            <p className="fw-card mb-3 px-3.5 py-3 text-[12.5px] text-[#20201d]">{notes.summary}</p>

            {draftItems.length > 0 ? (
              <AdminList items={draftItems} />
            ) : (
              <p className="fw-card px-4 py-8 text-center text-[12px] text-[#a19d90]">
                No items in this draft.
              </p>
            )}

            <p className="mt-3 text-[11px] text-[#a19d90]">
              {notes.rawIssues.length} source issue{notes.rawIssues.length !== 1 ? "s" : ""} · {fromDate} to {toDate}
            </p>
          </div>
        )}

        <Note icon="ℹ" tone="info">
          Nothing is published automatically — review the draft, then use &ldquo;Copy as Markdown&rdquo; to paste it into your changelog.
        </Note>
      </div>
    </div>
  );
}
