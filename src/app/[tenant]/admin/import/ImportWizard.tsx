"use client";

import { useMemo, useState, useTransition } from "react";
import { type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { importIssuesAction, type ImportRow, type NewCategory, type ImportResult } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminTable from "@/components/patterns/admin/AdminTable";
import Note from "@/components/patterns/admin/Note";

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

const BUILTIN_FIELDS = [
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

const BUILTIN_AUTO_MAP: Record<string, string> = {
  title: "title", name: "title",
  description: "description", desc: "description", body: "description",
  status: "status",
  priority: "priority", severity: "priority", sev: "priority",
  type: "type", kind: "type",
  category: "category", cat: "category",
  subcategory: "subcategory", sub_category: "subcategory", sub: "subcategory",
  external_id: "external_id", ext_id: "external_id", id: "external_id", external: "external_id",
};

function buildAutoMapper(customFields: CustomField[]) {
  return function autoMap(header: string): string {
    const key = header.trim().toLowerCase().replace(/[\s-]/g, "_").replace(/[^a-z_]/g, "");
    if (BUILTIN_AUTO_MAP[key]) return BUILTIN_AUTO_MAP[key];
    const cf = customFields.find(
      (f) => f.key === key || f.label.trim().toLowerCase().replace(/[\s-]/g, "_").replace(/[^a-z_]/g, "") === key
    );
    return cf ? `custom:${cf.key}` : "";
  };
}

type NewCatEntry = { parent: string; sub: string | null; key: string };

export default function ImportWizard({
  slug, projects, statuses, priorities, types, categories, customFields,
}: {
  slug: string;
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
}) {
  const importableFields = useMemo(() => [
    ...BUILTIN_FIELDS,
    ...customFields.map((f) => ({ key: `custom:${f.key}`, label: `${f.label} (custom)` })),
  ], [customFields]);

  const autoMap = useMemo(() => buildAutoMapper(customFields), [customFields]);

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

      // Collect custom field values from any columns mapped to custom:*
      const custom_values: Record<string, string> = {};
      for (const [col, fieldKey] of Object.entries(mapping)) {
        if (!fieldKey.startsWith("custom:")) continue;
        const cfKey = fieldKey.slice(7);
        const val = (row[Number(col)] ?? "").trim();
        if (val) custom_values[cfKey] = val;
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
        custom_values: Object.keys(custom_values).length > 0 ? custom_values : undefined,
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

  const selectCls = "rounded-[5px] border border-[#ddd8c9] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-[#8c4632]";
  const willImport = (analysis?.mappedRows.length ?? 0) - skippedByCat;

  const STEP_LABELS = ["Upload", "Map columns", "Review & import"];

  return (
    <div className="space-y-6">
      <PageHeader title="Import Issues" subtitle="Bring work in from CSV or another tracker" />

      <div className="max-w-3xl space-y-6 px-6">
        {/* Step indicator */}
        <div className="flex items-center gap-3 text-[11.5px]">
          {STEP_LABELS.map((label, i) => {
            const active = step === i + 1 || (step === "done" && i === 2);
            return (
              <span key={i} className="flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={active ? { background: "#8c4632", color: "#f2e9d8" } : { background: "#e3ded0", color: "#a19d90" }}
                >
                  {i + 1}
                </span>
                <span className={active ? "font-semibold text-[#20201d]" : "text-[#a19d90]"}>{label}</span>
                {i < 2 && <span className="text-[#cfc9b9]">→</span>}
              </span>
            );
          })}
        </div>

        {error && (
          <p className="rounded-[6px] border border-[#f0cfc9] bg-[#fbeae8] px-3 py-2 text-[12px] text-[#a3372a]">{error}</p>
        )}

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div>
            {projects.length > 1 && (
              <label className="mb-4 flex flex-col gap-1 text-[11.5px] text-[#726e60]">
                Import into project
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectCls}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label
              className="fw-card flex cursor-pointer flex-col items-center gap-4 border-dashed px-6 py-12 text-center transition hover:border-[#8c4632]/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <svg className="h-9 w-9 text-[#cfc9b9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="text-[12.5px] font-semibold text-[#4a473e]">Drop a CSV here, or click to choose a file</p>
                <p className="mt-1 text-[11px] text-[#a19d90]">
                  Supported columns: title, description, status, priority, type, category, subcategory, external_id
                  {customFields.length > 0 && `, plus ${customFields.length} custom field${customFields.length !== 1 ? "s" : ""}`}
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
            <p className="mb-4 text-[12.5px] text-[#726e60]">
              Your CSV has <strong className="text-[#20201d]">{headers.length} columns</strong> and{" "}
              <strong className="text-[#20201d]">{dataRows.length} data rows</strong>. Map each column to an issue field, or ignore it.
            </p>
            <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Column mapping</h2>
            <AdminTable
              minWidth={520}
              columns={[
                { label: "CSV column", flex: true },
                { label: "Sample value", flex: true },
                { label: "Maps to", width: 200 },
              ]}
              rows={headers.map((h, i) => [
                { kind: "mono", value: h },
                { kind: "dim", value: dataRows[0]?.[i] ?? "—" },
                {
                  kind: "text",
                  value: (
                    <select
                      value={mapping[i] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                      className={selectCls}
                    >
                      {importableFields.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  ),
                },
              ])}
            />
            {!Object.values(mapping).includes("title") && (
              <div className="mt-3">
                <Note icon="⚠" tone="warning">
                  Map at least one column to <strong>Title *</strong> to continue.
                </Note>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2 text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da]">
                ← Back
              </button>
              <button
                onClick={goToReview}
                disabled={!Object.values(mapping).includes("title")}
                className="rounded-[5px] border border-[#5e2c1f] px-4 py-2 text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-40"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
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
              <div className="fw-card mb-5 p-4">
                <p className="mb-1 text-[12.5px] font-semibold text-[#20201d]">
                  {analysis.newCats.length} new {analysis.newCats.length === 1 ? "category" : "categories"} found in your CSV
                </p>
                <p className="mb-3 text-[11.5px] text-[#726e60]">
                  Select which to create. Rows belonging to unchecked categories will be skipped.
                </p>
                <div className="flex flex-col gap-2">
                  {analysis.newCats.map((cat) => (
                    <label key={cat.key} className="flex cursor-pointer items-center gap-2.5 text-[12.5px]">
                      <input
                        type="checkbox"
                        checked={selectedCats.has(cat.key)}
                        onChange={() => toggleCat(cat.key, cat)}
                        className="h-4 w-4 rounded border-[#ddd8c9] accent-[#8c4632]"
                      />
                      <span className="text-[#20201d]">
                        {cat.sub ? (
                          <><span className="text-[#8c4632]">{cat.parent}</span> → {cat.sub}</>
                        ) : (
                          cat.parent
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                {skippedByCat > 0 && (
                  <p className="mt-3 text-[11.5px] text-[#726e60]">
                    {skippedByCat} row{skippedByCat !== 1 ? "s" : ""} will be skipped (their category won&apos;t be created).
                  </p>
                )}
              </div>
            )}

            {/* Summary counts */}
            <StatsRow
              items={[
                { label: "Rows detected", value: dataRows.length },
                { label: "Will import", value: willImport, color: "#2f6e35" },
                { label: "Skipped", value: skippedByCat, color: "#726e60" },
                { label: "Errors", value: analysis.rowErrors.length, color: analysis.rowErrors.length > 0 ? "#a3372a" : undefined },
              ]}
            />

            {/* Row errors */}
            {analysis.rowErrors.length > 0 && (
              <div className="mt-5">
                <Note icon="⚠" tone="warning">
                  <span className="font-semibold">{analysis.rowErrors.length} row{analysis.rowErrors.length !== 1 ? "s" : ""} with errors</span> will be skipped —
                  Row {analysis.rowErrors[0].row}: {analysis.rowErrors[0].message}
                  {analysis.rowErrors.length > 1 && ` (and ${analysis.rowErrors.length - 1} more)`}
                </Note>
                <ul className="mt-2 space-y-1 pl-1">
                  {analysis.rowErrors.slice(0, 10).map((e, i) => (
                    <li key={i} className="text-[11px] text-[#a3372a]">Row {e.row}: {e.message}</li>
                  ))}
                  {analysis.rowErrors.length > 10 && (
                    <li className="text-[11px] text-[#c98b82]">…and {analysis.rowErrors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2 text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da]">
                ← Back
              </button>
              <button
                onClick={doImport}
                disabled={pending || willImport === 0}
                className="rounded-[5px] border border-[#5e2c1f] px-4 py-2 text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-40"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                {pending ? "Importing…" : `Import ${willImport} issue${willImport !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && result && (
          <div>
            <StatsRow
              items={[
                { label: "Created", value: result.created, color: "#2f6e35" },
                { label: "Skipped", value: result.skipped, color: "#726e60" },
                { label: "Errors", value: result.errors.length, color: result.errors.length > 0 ? "#a3372a" : undefined },
              ]}
            />

            {result.errors.length > 0 && (
              <div className="mt-5">
                <Note icon="⚠" tone="warning">
                  {result.errors.length} error{result.errors.length !== 1 ? "s" : ""} during import — Row {result.errors[0].row}: {result.errors[0].message}
                </Note>
                <ul className="mt-2 space-y-1 pl-1">
                  {result.errors.slice(0, 15).map((e, i) => (
                    <li key={i} className="text-[11px] text-[#a3372a]">Row {e.row}: {e.message}</li>
                  ))}
                  {result.errors.length > 15 && (
                    <li className="text-[11px] text-[#c98b82]">…and {result.errors.length - 15} more</li>
                  )}
                </ul>
              </div>
            )}

            <button onClick={reset} className="mt-5 rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-4 py-2 text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da]">
              Import another file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
