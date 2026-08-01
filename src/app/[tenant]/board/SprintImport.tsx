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
      <p className="text-xs text-[#726e60]">
        Paste your sprint plan or upload a text/markdown file. Grok will extract sprint names, goals, and dates.
      </p>
      <textarea
        value={importText}
        onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
        placeholder={"Sprint 1 (July 7–18): Foundation — set up auth, DB schema, CI\nSprint 2 (July 21–Aug 1): Core CRUD — issues, projects, boards\n..."}
        rows={6}
        className="w-full rounded-lg border border-[#ddd8c9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b7452f] font-mono resize-y"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-[#ddd8c9] px-3 py-1.5 text-xs font-medium text-[#4a473e] hover:bg-[#f4f2eb]"
        >
          Upload .txt / .md
        </button>
        <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv" className="hidden" onChange={onFileChange} />
        <span className="text-xs text-[#a19d90]">PDF/Word: copy-paste the text above</span>
      </div>

      {!importPreview ? (
        <div className="flex gap-2">
          <button onClick={parseDoc} disabled={importParsing || !importText.trim()}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-[#f2e9d8] disabled:opacity-50"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}>
            {importParsing ? "Parsing with AI…" : "Parse with AI →"}
          </button>
          <button onClick={onClose} className="rounded-lg border border-[#ddd8c9] px-4 py-1.5 text-xs font-medium text-[#4a473e] hover:bg-[#f4f2eb]">Cancel</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#20201d]">{importPreview.length} sprint{importPreview.length !== 1 ? "s" : ""} found — review before creating:</p>
          <div className="rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#f1efe9] text-[#726e60]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Goal</th>
                  <th className="px-3 py-2 text-left font-medium">Start</th>
                  <th className="px-3 py-2 text-left font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((s, i) => (
                  <tr key={i} className="border-t border-[#ddd8c9]">
                    <td className="px-3 py-1.5 text-[#4a473e] font-medium">{s.name || "—"}</td>
                    <td className="px-3 py-1.5 text-[#726e60] max-w-[160px] truncate">{s.goal || "—"}</td>
                    <td className="px-3 py-1.5 text-[#726e60]">{s.startDate || "—"}</td>
                    <td className="px-3 py-1.5 text-[#726e60]">{s.endDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-xs text-[#c0392b]">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => createBulk(importPreview)} disabled={pending}
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-[#f2e9d8] disabled:opacity-50"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)", border: "1px solid #5e2c1f" }}>
              {pending ? "Creating…" : `Create ${importPreview.length} sprints`}
            </button>
            <button onClick={() => setImportPreview(null)} className="rounded-lg border border-[#ddd8c9] px-4 py-1.5 text-xs font-medium text-[#4a473e] hover:bg-[#f4f2eb]">
              Re-parse
            </button>
            <button onClick={onClose} className="rounded-lg border border-[#ddd8c9] px-4 py-1.5 text-xs font-medium text-[#4a473e] hover:bg-[#f4f2eb]">Cancel</button>
          </div>
        </div>
      )}
      {error && !importPreview && <p className="text-xs text-[#c0392b]">{error}</p>}
    </div>
  );
}
