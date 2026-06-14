"use client";

import { useState, useTransition } from "react";
import {
  addOptionAction, deleteOptionAction, setDefaultAction, addCategoryAction, deleteCategoryAction,
  addCustomFieldAction, deleteCustomFieldAction,
} from "./actions";
import type { FieldName, CustomFieldType } from "@/lib/repositories/fieldConfig";

type Option = { id: string; field: FieldName; key: string; label: string; is_default: boolean };
type Category = { id: string; parent_id: string | null; name: string };
type CustomField = { id: string; key: string; label: string; type: CustomFieldType; options: string[]; required: boolean };
type Schema = { statuses: Option[]; priorities: Option[]; types: Option[]; categories: Category[]; customFields: CustomField[] };

export default function FieldsManager({ slug, schema, readOnly = false }: { slug: string; schema: Schema; readOnly?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  const tops = schema.categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => schema.categories.filter((c) => c.parent_id === id);

  return (
    <div className={`mt-6 space-y-6 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <FieldSection title="Statuses" field="status" options={schema.statuses} slug={slug} run={run} pending={pending} />
      <FieldSection title="Priorities" field="priority" options={schema.priorities} slug={slug} run={run} pending={pending} />
      <FieldSection title="Types" field="type" options={schema.types} slug={slug} run={run} pending={pending} />

      {/* Categories */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-800">Categories</h2>
          <AddInline placeholder="New category…" onAdd={(v) => run(() => addCategoryAction(slug, v, null))} pending={pending} />
        </div>
        {tops.length === 0 && <p className="text-sm text-neutral-400">No categories yet.</p>}
        <ul className="space-y-3">
          {tops.map((cat) => (
            <li key={cat.id}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-800">{cat.name}</span>
                <button onClick={() => run(() => deleteCategoryAction(slug, cat.id))} className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </div>
              <ul className="ml-4 mt-1 space-y-1 border-l border-neutral-200 pl-3">
                {childrenOf(cat.id).map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">{sub.name}</span>
                    <button onClick={() => run(() => deleteCategoryAction(slug, sub.id))} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
                <li>
                  <AddInline small placeholder="Add sub-category…" onAdd={(v) => run(() => addCategoryAction(slug, v, cat.id))} pending={pending} />
                </li>
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <CustomFieldsSection slug={slug} fields={schema.customFields} run={run} pending={pending} />
    </div>
  );
}

function CustomFieldsSection({
  slug, fields, run, pending,
}: {
  slug: string; fields: CustomField[];
  run: (fn: () => Promise<unknown>) => void; pending: boolean;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);

  function add() {
    if (!label.trim()) return;
    const options = type === "select" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : [];
    run(() => addCustomFieldAction(slug, { label: label.trim(), type, options, required }));
    setLabel(""); setOptionsText(""); setRequired(false); setType("text");
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-neutral-800">Custom fields</h2>
      <p className="mb-3 text-xs text-neutral-500">Extra fields captured on every issue, defined however your team tracks work.</p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Field name (e.g. Severity)"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
          <option value="date">Date</option>
        </select>
        {type === "select" && (
          <input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="Options (comma-separated)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        )}
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
        </label>
        <button onClick={add} disabled={pending || !label.trim()} className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40">
          Add field
        </button>
      </div>
      <ul className="space-y-1.5">
        {fields.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 text-sm">
            <span className="text-neutral-800">
              {f.label} <span className="text-xs text-neutral-400">· {f.type}{f.required ? " · required" : ""}{f.type === "select" && f.options.length ? ` · ${f.options.join("/")}` : ""}</span>
            </span>
            <button onClick={() => run(() => deleteCustomFieldAction(slug, f.id))} className="text-xs text-red-600 hover:underline">Delete</button>
          </li>
        ))}
        {fields.length === 0 && <li className="text-sm text-neutral-400">No custom fields yet.</li>}
      </ul>
    </div>
  );
}

function FieldSection({
  title, field, options, slug, run, pending,
}: {
  title: string; field: FieldName; options: Option[]; slug: string;
  run: (fn: () => Promise<unknown>) => void; pending: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        <AddInline placeholder={`New ${field}…`} onAdd={(v) => run(() => addOptionAction(slug, field, v))} pending={pending} />
      </div>
      <ul className="space-y-1.5">
        {options.map((o) => (
          <li key={o.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 text-sm">
            <span className="text-neutral-800">
              {o.label}
              {o.is_default && <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600">default</span>}
            </span>
            <span className="flex items-center gap-3">
              {!o.is_default && (
                <button onClick={() => run(() => setDefaultAction(slug, o.id, field))} className="text-xs text-neutral-500 hover:underline">
                  Make default
                </button>
              )}
              <button onClick={() => run(() => deleteOptionAction(slug, o.id))} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddInline({
  placeholder, onAdd, pending, small,
}: {
  placeholder: string; onAdd: (v: string) => void; pending: boolean; small?: boolean;
}) {
  const [v, setV] = useState("");
  function submit() { if (v.trim()) { onAdd(v.trim()); setV(""); } }
  return (
    <div className="flex items-center gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className={`rounded-lg border border-neutral-300 px-2 py-1 outline-none focus:border-neutral-900 ${small ? "text-xs" : "text-sm"}`}
      />
      <button
        onClick={submit}
        disabled={pending || !v.trim()}
        className={`rounded-lg bg-neutral-900 px-2.5 py-1 font-medium text-white hover:bg-neutral-800 disabled:opacity-40 ${small ? "text-xs" : "text-sm"}`}
      >
        Add
      </button>
    </div>
  );
}
