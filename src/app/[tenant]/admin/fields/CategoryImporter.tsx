"use client";

import { useRef, useState, useTransition } from "react";
import { importCategoriesAction } from "./actions";

type Project = { id: string; key: string; name: string };
type PreviewRow = { name: string; parent_name: string };

const TEMPLATE_CSV = `name,parent_name
Admin Portal,
Advisor Portal,
Budget,Itinerary
Compass,Itinerary
`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "forge-categories-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): { rows: PreviewRow[]; error: string | null } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: "CSV must have a header row and at least one data row." };
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const nameIdx = header.indexOf("name");
  const parentIdx = header.indexOf("parent_name");
  if (nameIdx === -1) return { rows: [], error: 'CSV must have a "name" column.' };
  const rows: PreviewRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const name = cols[nameIdx] ?? "";
    const parent_name = parentIdx !== -1 ? (cols[parentIdx] ?? "") : "";
    if (!name) continue;
    rows.push({ name, parent_name });
  }
  if (rows.length === 0) return { rows: [], error: "No valid rows found." };
  return { rows, error: null };
}

export default function CategoryImporter({
  slug,
  projects,
  defaultProjectId,
}: {
  slug: string;
  projects: Project[];
  defaultProjectId?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, error } = parseCsv(text);
      setParseError(error);
      setPreview(error ? null : rows);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!preview || !projectId) return;
    startTransition(async () => {
      const r = await importCategoriesAction(slug, projectId, preview, replace);
      setResult(r);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function reset() {
    setPreview(null);
    setParseError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const tops = preview ? preview.filter((r) => !r.parent_name) : [];
  const subsOf = (name: string) => preview ? preview.filter((r) => r.parent_name === name) : [];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition"
      >
        ↑ Import CSV
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Import categories from CSV</h3>
        <button onClick={() => { setOpen(false); reset(); }} className="text-xs text-neutral-400 hover:text-neutral-700">✕ Close</button>
      </div>

      {/* Download template */}
      <div className="flex items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition"
        >
          ↓ Download template
        </button>
        <span className="text-xs text-neutral-400">Two columns: <code className="bg-neutral-100 px-1 rounded">name</code> and <code className="bg-neutral-100 px-1 rounded">parent_name</code>. Leave parent_name blank for top-level categories.</span>
      </div>

      {/* Project picker — only shown when no default project */}
      {!defaultProjectId && projects.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Target project</label>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); reset(); }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* File upload */}
      {!preview && !result && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Upload CSV file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-neutral-700 file:hover:bg-neutral-50 file:cursor-pointer"
          />
        </div>
      )}

      {parseError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{parseError}</p>
      )}

      {/* Preview tree */}
      {preview && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-neutral-600">
            Preview — {tops.length} top-level, {preview.length - tops.length} sub-categories
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
            {tops.map((cat) => (
              <div key={cat.name}>
                <p className="text-sm font-medium text-neutral-800">{cat.name}</p>
                {subsOf(cat.name).map((sub) => (
                  <p key={sub.name} className="ml-4 text-xs text-neutral-500 border-l border-neutral-200 pl-2 mt-0.5">
                    — {sub.name}
                  </p>
                ))}
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="rounded border-neutral-300"
            />
            <span>Replace existing categories for this project (deletes current ones first)</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={isPending}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 transition"
            >
              {isPending ? "Importing…" : `Confirm import (${preview.length} rows)`}
            </button>
            <button onClick={reset} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg border px-4 py-3 text-sm space-y-1 ${result.errors.length > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
          <p className={result.errors.length > 0 ? "text-amber-800 font-medium" : "text-green-800 font-medium"}>
            {result.created} categories imported successfully.
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-amber-700 text-xs">{e}</p>
          ))}
          <button onClick={() => { reset(); setOpen(false); }} className="mt-1 text-xs underline text-neutral-600 hover:text-neutral-900">Done</button>
        </div>
      )}
    </div>
  );
}
