"use client";

import { useRef, useState, useTransition } from "react";
import { importCategoriesAction } from "./actions";
import Toggle from "@/components/patterns/Toggle";

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
        className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#f4f2eb] transition"
      >
        ↑ Import CSV
      </button>
    );
  }

  return (
    <div className="fw-card mt-4 space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[12.5px] font-bold text-[#20201d]">Import categories from CSV</h3>
        <button onClick={() => { setOpen(false); reset(); }} className="text-[11px] text-[#a19d90] hover:text-[#4a473e]">✕ Close</button>
      </div>

      {/* Download template */}
      <div className="flex items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#f4f2eb] transition"
        >
          ↓ Download template
        </button>
        <span className="text-[11px] text-[#a19d90]">Two columns: <code className="rounded bg-[#f1efe9] px-1">name</code> and <code className="rounded bg-[#f1efe9] px-1">parent_name</code>. Leave parent_name blank for top-level categories.</span>
      </div>

      {/* Project picker — only shown when no default project */}
      {!defaultProjectId && projects.length > 1 && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Target project</label>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); reset(); }}
            className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]"
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
          <label className="mb-1 block text-[11px] font-semibold text-[#726e60]">Upload CSV file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="text-[12.5px] text-[#4a473e] file:mr-3 file:rounded-[5px] file:border file:border-[#ddd8c9] file:bg-white file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-[#4a473e] file:hover:bg-[#f4f2eb] file:cursor-pointer"
          />
        </div>
      )}

      {parseError && (
        <p className="rounded-[6px] border border-[#f0cfc9] bg-[#fbeae8] px-3 py-2 text-[11.5px] text-[#a13a2f]">{parseError}</p>
      )}

      {/* Preview tree */}
      {preview && (
        <div className="space-y-3">
          <p className="text-[11.5px] font-semibold text-[#726e60]">
            Preview — {tops.length} top-level, {preview.length - tops.length} sub-categories
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-[6px] border border-[#e3ded0] bg-white p-3">
            {tops.map((cat) => (
              <div key={cat.name}>
                <p className="text-[12.5px] font-semibold text-[#20201d]">{cat.name}</p>
                {subsOf(cat.name).map((sub) => (
                  <p key={sub.name} className="ml-4 mt-0.5 border-l border-[#e3ded0] pl-2 text-[11px] text-[#726e60]">
                    — {sub.name}
                  </p>
                ))}
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2.5 text-[11.5px] text-[#4a473e]">
            <Toggle on={replace} onChange={setReplace} label="Replace existing categories" />
            <span>Replace existing categories for this project (deletes current ones first)</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={isPending}
              className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50 transition"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              {isPending ? "Importing…" : `Confirm import (${preview.length} rows)`}
            </button>
            <button onClick={reset} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da] transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className="space-y-1 rounded-[6px] border px-4 py-3 text-[12px]"
          style={result.errors.length > 0 ? { borderColor: "#f0dcb8", backgroundColor: "#fdf1de" } : { borderColor: "#d7e3d3", backgroundColor: "#e3ecdf" }}
        >
          <p className="font-semibold" style={{ color: result.errors.length > 0 ? "#c9791d" : "#3f6b43" }}>
            {result.created} categories imported successfully.
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-[11px]" style={{ color: "#c9791d" }}>{e}</p>
          ))}
          <button onClick={() => { reset(); setOpen(false); }} className="mt-1 text-[11px] font-semibold text-[#726e60] underline hover:text-[#20201d]">Done</button>
        </div>
      )}
    </div>
  );
}
