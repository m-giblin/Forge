"use client";

import { useMemo, useState, useTransition } from "react";
import { type FieldOption, type Category } from "@/lib/repositories/fieldConfig";
import { importIssuesAction, type ImportRow, type NewCategory, type ImportResult } from "./actions";

type Project = { id: string; key: string; name: string };

// Minimal RFC-4180 CSV parser — handles quotes, embedded commas/newlines.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", i = 0, inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const IMPORTABLE_FIELDS = [
  { key: "", label: "— Ignore —" },
  { key: "title", label: "Title *" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "external_id", label: "External ID (idempotency key)" },
];

const AUTO_MAP: Record<string, string> = {
  title: "title", name: "title",
  description: "description", desc: "description", body: "description",
  status: "status",
  priority: "priority", severity: "priority", sev: "priority",
  type: "type", kind: "type",
  category: "category", cat: "category",
  subcategory: "subcategory", sub_category: "subcategory", sub: "subcategory",
  external_id: "external_id", ext_id: "external_id", id: "external_id", external: "external_id",
};

function autoMap(header: string): string {
  const key = header.trim().toLowerCase().replace(/[\s-]/g, "_").replace(/[^a-z_]/g, "");
  return AUTO_MAP[key] ?? "";
}

type NewCatEntry = { parent: string; sub: string | null; key: string };

export default function ImportWizard({
  slug, projects, statuses, priorities, types, categories,
}: {
  slug: string;
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
}) {
  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) { setError("CSV must have a header row and at least one data row."); return; }
      const hdrs = rows[0].map((h) => h.trim());
      setHeaders(hdrs);
      setDataRows(rows.slice(1));
      const m: Record<number, string> = {};
      hdrs.forEach((h, i) => { m[i] = autoMap(h); });
      setMapping(m);
      setStep(2);
    };
    reader.readAsText(file);
  }

  // Computed in step 3: validate all rows client-side against tenant options + existing categories.
  const analysis = useMemo(() => {
    if (step !== 3 && step !== "done") return null;

    const resolveOpt = (field: string, value: string): string | null => {
      const v = value.trim().toLowerCase();
      const opts = field === "status" ? statuses : field === "priority" ? priorities : types;
      return opts.find((o) => o.key.toLowerCase() === v || o.label.toLowerCase() === v)?.key ?? null;
    };

    const fieldToCol = new Map<string, number>();
    Object.entries(mapping).forEach(([col, field]) => { if (field) fieldToCol.set(field, Number(col)); });
    const get = (row: string[], field: string) => {
      const col = fieldToCol.get(field);
      return col !== undefined ? (row[col] ?? "").trim() : "";
    };

    const mappedRows: ImportRow[] = [];
    const rowErrors: { row: number; message: string }[] = [];
    const seenCatKeys = new Set<string>();
    const newCats: NewCatEntry[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 1;
      const title = get(row, "title");

      if (!title) { rowErrors.push({ row: rowNum, message: "Missing title" }); continue; }

      const statusVal = get(row, "status");
      const priorityVal = get(row, "priority");
      const typeVal = get(row, "type");

      if (statusVal && !resolveOpt("status", statusVal)) {
        rowErrors.push({ row: rowNum, message: `Unknown status "${statusVal}"` }); continue;
      }
      if (priorityVal && !resolveOpt("priority", priorityVal)) {
        rowErrors.push({ row: rowNum, message: `Unknown priority "${priorityVal}"` }); continue;
      }
      if (typeVal && !resolveOpt("type", typeVal)) {
        rowErrors.push({ row: rowNum, message: `Unknown type "${typeVal}"` }); continue;
      }

      // Detect new categories.
      const catVal = get(row, "category");
      const subVal = get(row, "subcategory");
      if (catVal) {
        const existingParent = categories.find(
          (c) => !c.parent_id && c.name.toLowerCase() === catVal.toLowerCase()
        );
        if (!existingParent) {
          const key = catVal;
          if (!seenCatKeys.has(key)) { seenCatKeys.add(key); newCats.push({ parent: catVal, sub: null, key }); }
        } else if (subVal) {
          const existingSub = categories.find(
            (c) => c.parent_id === existingParent.id && c.name.toLowerCase() === subVal.toLowerCase()
          );
          if (!existingSub) {
            const key = `${catVal}/${subVal}`;
            if (!seenCatKeys.has(key)) { seenCatKeys.add(key); newCats.push({ parent: catVal, sub: subVal, key }); }
          }
        }
      }

      mappedRows.push({
        title,
        description: get(row, "description") || undefined,
        status: statusVal || undefined,
        priority: priorityVal || undefined,
        type: typeVal || undefined,
        category: catVal || undefined,
        subcategory: subVal || undefined,
        external_id: get(row, "external_id") || undefined,
      });
    }

    return { mappedRows, rowErrors, newCats };
  }, [step, dataRows, mapping, statuses, priorities, types, categories]);

  function goToReview() {
    if (!analysis) return;
    // Pre-select all new categories.
    setSelectedCats(new Set(analysis.newCats.map((c) => c.key)));
    setStep(3);
  }

  function toggleCat(key: string, entry: NewCatEntry) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Unchecking a parent auto-unchecks its subcategories.
        if (entry.sub === null) {
          analysis?.newCats.forEach((c) => {
            if (c.sub !== null && c.parent.toLowerCase() === entry.parent.toLowerCase()) next.delete(c.key);
          });
        }
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Rows that will be skipped because their new parent category was unchecked.
  const skippedByCat = useMemo(() => {
    if (!analysis) return 0;
    const uncheckedNewParents = new Set(
      analysis.newCats
        .filter((c) => c.sub === null && !selectedCats.has(c.key))
        .map((c) => c.parent.toLowerCase())
    );
    return analysis.mappedRows.filter(
      (r) => r.category && uncheckedNewParents.has(r.category.toLowerCase())
    ).length;
  }, [analysis, selectedCats]);

  function doImport() {
    if (!analysis) return;
    const createCats: NewCategory[] = analysis.newCats
      .filter((c) => selectedCats.has(c.key))
      .map((c) => ({ name: c.sub ?? c.parent, parentName: c.sub ? c.parent : null }));

    setError(null);
    startTransition(async () => {
      try {
        const r = await importIssuesAction(slug, projectId, analysis.mappedRows, createCats);
        setResult(r);
        setStep("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed.");
      }
    });
  }

  function reset() {
    setStep(1); setHeaders([]); setDataRows([]); setMapping({});
    setSelectedCats(new Set()); setResult(null); setError(null);
  }

  const selectCls = "rounded-lg border border-neutral-300 px-2 py-1.5 text-sm";
  const willImport = (analysis?.mappedRows.length ?? 0) - skippedByCat;

  const STEP_LABELS = ["Upload", "Map columns", "Review & import"];

  return (
    <div className="max-w-2xl">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-3 text-xs">
        {STEP_LABELS.map((label, i) => {
          const active = step === i + 1 || (step === "done" && i === 2);
          return (
            <span key={i} className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-500"}`}>
                {i + 1}
              </span>
              <span className={active ? "font-semibold text-neutral-900" : "text-neutral-400"}>{label}</span>
              {i < 2 && <span className="text-neutral-300">→</span>}
            </span>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div>
          {projects.length > 1 && (
            <label className="mb-4 flex flex-col gap-1 text-xs text-neutral-500">
              Import into project
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectCls}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
                ))}
              </select>
            </label>
          )}
          <label
            className="flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed border-neutral-300 px-6 py-12 text-center transition hover:border-neutral-400 hover:bg-neutral-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <svg className="h-9 w-9 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p className="text-sm font-medium text-neutral-700">Drop a CSV here, or click to choose a file</p>
              <p className="mt-1 text-xs text-neutral-400">
                Supported columns: title, description, status, priority, type, category, subcategory, external_id
              </p>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 2 && (
        <div>
          <p className="mb-4 text-sm text-neutral-500">
            Your CSV has <strong>{headers.length} columns</strong> and <strong>{dataRows.length} data rows</strong>.
            Map each column to an issue field, or ignore it.
          </p>
          <table className="mb-5 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-400">
                <th className="pb-2 pr-4 font-medium">CSV column</th>
                <th className="pb-2 pr-4 font-medium">Sample</th>
                <th className="pb-2 font-medium">Maps to</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2 pr-4 font-mono text-xs text-neutral-700">{h}</td>
                  <td className="max-w-[160px] truncate py-2 pr-4 text-xs text-neutral-400">
                    {dataRows[0]?.[i] ?? "—"}
                  </td>
                  <td className="py-2">
                    <select
                      value={mapping[i] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                      className={selectCls}
                    >
                      {IMPORTABLE_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!Object.values(mapping).includes("title") && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Map at least one column to <strong>Title *</strong> to continue.
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
              ← Back
            </button>
            <button
              onClick={goToReview}
              disabled={!Object.values(mapping).includes("title")}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && analysis && (
        <div>
          {/* New categories panel */}
          {analysis.newCats.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 text-sm font-semibold text-amber-900">
                {analysis.newCats.length} new {analysis.newCats.length === 1 ? "category" : "categories"} found in your CSV
              </p>
              <p className="mb-3 text-xs text-amber-700">
                Select which to create. Rows belonging to unchecked categories will be skipped.
              </p>
              <div className="flex flex-col gap-2">
                {analysis.newCats.map((cat) => (
                  <label key={cat.key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCats.has(cat.key)}
                      onChange={() => toggleCat(cat.key, cat)}
                      className="h-4 w-4 rounded border-amber-400 accent-amber-600"
                    />
                    <span className="text-amber-900">
                      {cat.sub ? (
                        <><span className="text-amber-600">{cat.parent}</span> → {cat.sub}</>
                      ) : (
                        cat.parent
                      )}
                    </span>
                  </label>
                ))}
              </div>
              {skippedByCat > 0 && (
                <p className="mt-3 text-xs text-amber-700">
                  {skippedByCat} row{skippedByCat !== 1 ? "s" : ""} will be skipped (their category won&apos;t be created).
                </p>
              )}
            </div>
          )}

          {/* Summary counts */}
          <div className="mb-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-green-50 p-3">
              <p className="text-2xl font-bold text-green-700">{willImport}</p>
              <p className="text-xs text-green-600">will import</p>
            </div>
            <div className="rounded-xl bg-neutral-100 p-3">
              <p className="text-2xl font-bold text-neutral-500">{skippedByCat}</p>
              <p className="text-xs text-neutral-400">will skip</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-2xl font-bold text-red-600">{analysis.rowErrors.length}</p>
              <p className="text-xs text-red-500">row errors</p>
            </div>
          </div>

          {/* Row errors */}
          {analysis.rowErrors.length > 0 && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 text-xs font-semibold text-red-700">Rows with errors (will be skipped):</p>
              <ul className="space-y-1">
                {analysis.rowErrors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</li>
                ))}
                {analysis.rowErrors.length > 10 && (
                  <li className="text-xs text-red-400">…and {analysis.rowErrors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
              ← Back
            </button>
            <button
              onClick={doImport}
              disabled={pending || willImport === 0}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {pending ? "Importing…" : `Import ${willImport} issue${willImport !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {step === "done" && result && (
        <div>
          <div className="mb-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-3xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600">created</p>
            </div>
            <div className="rounded-xl bg-neutral-100 p-4">
              <p className="text-3xl font-bold text-neutral-500">{result.skipped}</p>
              <p className="text-xs text-neutral-400">skipped (already exist)</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-3xl font-bold text-red-600">{result.errors.length}</p>
              <p className="text-xs text-red-500">errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 text-xs font-semibold text-red-700">Errors during import:</p>
              <ul className="space-y-1">
                {result.errors.slice(0, 15).map((e, i) => (
                  <li key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</li>
                ))}
                {result.errors.length > 15 && (
                  <li className="text-xs text-red-400">…and {result.errors.length - 15} more</li>
                )}
              </ul>
            </div>
          )}

          <button onClick={reset} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
