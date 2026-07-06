"use client";

import { useState, useTransition, useRef } from "react";
import { bulkCreateSprintsAction, parseSprintDocAction } from "./sprintActions";

type BulkSprint = { name: string; goal: string; startDate: string; endDate: string };

export default function SprintImport({
  slug,
  projectId,
  onClose,
  onDone,
}: {
  slug: string;
  projectId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importParsing, setImportParsing] = useState(false);
  const [importPreview, setImportPreview] = useState<BulkSprint[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function parseDoc() {
    if (!importText.trim()) return;
    setImportParsing(true);
    setError(null);
    try {
      const parsed = await parseSprintDocAction(slug, importText);
      setImportPreview(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI parse failed");
    } finally {
      setImportParsing(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  function createBulk(sprints: BulkSprint[]) {
    setError(null);
    startTransition(async () => {
      try {
        await bulkCreateSprintsAction(slug, projectId, sprints);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Paste your sprint plan or upload a text/markdown file. Grok will extract sprint names, goals, and dates.
      </p>
      <textarea
        value={importText}
        onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
        placeholder={"Sprint 1 (July 7–18): Foundation — set up auth, DB schema, CI\nSprint 2 (July 21–Aug 1): Core CRUD — issues, projects, boards\n..."}
        rows={6}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono resize-y"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          Upload .txt / .md
        </button>
        <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv" className="hidden" onChange={onFileChange} />
        <span className="text-xs text-neutral-400">PDF/Word: copy-paste the text above</span>
      </div>

      {!importPreview ? (
        <div className="flex gap-2">
          <button onClick={parseDoc} disabled={importParsing || !importText.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {importParsing ? "Parsing with AI…" : "Parse with AI →"}
          </button>
          <button onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-neutral-700">{importPreview.length} sprint{importPreview.length !== 1 ? "s" : ""} found — review before creating:</p>
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-100 text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Goal</th>
                  <th className="px-3 py-2 text-left font-medium">Start</th>
                  <th className="px-3 py-2 text-left font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((s, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5 text-neutral-700 font-medium">{s.name || "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-500 max-w-[160px] truncate">{s.goal || "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{s.startDate || "—"}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{s.endDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => createBulk(importPreview)} disabled={pending}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
              {pending ? "Creating…" : `Create ${importPreview.length} sprints`}
            </button>
            <button onClick={() => setImportPreview(null)} className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
              Re-parse
            </button>
            <button onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
          </div>
        </div>
      )}
      {error && !importPreview && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
