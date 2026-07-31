"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  addOptionAction, deleteOptionAction, setDefaultAction, addCategoryAction, deleteCategoryAction,
  addComponentAction, deleteComponentAction,
  addCustomFieldAction, deleteCustomFieldAction, reorderOptionsAction, setRestrictStatusTransitionsAction,
  addIssueTemplateAction, deleteIssueTemplateAction,
} from "./actions";
import type { FieldName, CustomFieldType } from "@/lib/repositories/fieldConfig";
import type { IssueTemplate } from "@/lib/repositories/issueTemplates";

type Option = { id: string; field: FieldName; key: string; label: string; is_default: boolean };
type Category = { id: string; parent_id: string | null; name: string };
type Component = { id: string; name: string };
type CustomField = { id: string; key: string; label: string; type: CustomFieldType; options: string[]; required: boolean };
type Schema = {
  statuses: Option[]; priorities: Option[]; types: Option[]; categories: Category[]; components: Component[]; customFields: CustomField[];
  restrictStatusTransitions: boolean;
};

export default function FieldsManager({
  slug, schema, templates, readOnly = false,
}: {
  slug: string; schema: Schema; templates: IssueTemplate[]; readOnly?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [restrict, setRestrict] = useState(schema.restrictStatusTransitions);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  function toggleRestrict() {
    const next = !restrict;
    setRestrict(next);
    run(() => setRestrictStatusTransitionsAction(slug, next));
  }

  const tops = schema.categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => schema.categories.filter((c) => c.parent_id === id);

  return (
    <div className={`mt-6 space-y-6 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <FieldSection title="Statuses" field="status" options={schema.statuses} slug={slug} run={run} pending={pending} reorderable>
        <label className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <input type="checkbox" className="mt-0.5" checked={restrict} onChange={toggleRestrict} />
          <span>
            <span className="font-medium text-neutral-800">Restrict status changes to adjacent workflow steps.</span>{" "}
            When on, an issue can only move to the status directly before or after its current one in the order above — no skipping steps.
          </span>
        </label>
      </FieldSection>
      <FieldSection title="Priorities" field="priority" options={schema.priorities} slug={slug} run={run} pending={pending} reorderable />
      <FieldSection title="Types" field="type" options={schema.types} slug={slug} run={run} pending={pending} reorderable />

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

      <ComponentsSection slug={slug} components={schema.components} run={run} pending={pending} />

      <CustomFieldsSection slug={slug} fields={schema.customFields} run={run} pending={pending} />

      <IssueTemplatesSection
        slug={slug}
        templates={templates}
        types={schema.types}
        priorities={schema.priorities}
        run={run}
        pending={pending}
      />
    </div>
  );
}

function ComponentsSection({
  slug, components, run, pending,
}: {
  slug: string; components: Component[];
  run: (fn: () => Promise<unknown>) => void; pending: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Components</h2>
          <p className="text-xs text-neutral-500">Tag issues by the part of the product they touch — e.g. Auth, Billing, Mobile.</p>
        </div>
        <AddInline placeholder="New component…" onAdd={(v) => run(() => addComponentAction(slug, v))} pending={pending} />
      </div>
      <ul className="space-y-1.5">
        {components.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 text-sm">
            <span className="text-neutral-800">{c.name}</span>
            <button onClick={() => run(() => deleteComponentAction(slug, c.id))} className="text-xs text-red-600 hover:underline">Delete</button>
          </li>
        ))}
        {components.length === 0 && <li className="text-sm text-neutral-400">No components yet.</li>}
      </ul>
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

function IssueTemplatesSection({
  slug, templates, types, priorities, run, pending,
}: {
  slug: string; templates: IssueTemplate[]; types: Option[]; priorities: Option[];
  run: (fn: () => Promise<unknown>) => void; pending: boolean;
}) {
  const [name, setName] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [type, setType] = useState(types[0]?.key ?? "");
  const [priority, setPriority] = useState(priorities[0]?.key ?? "");

  function add() {
    if (!name.trim() || !type || !priority) return;
    run(() => addIssueTemplateAction(slug, { name: name.trim(), titlePrefix, type, priority }));
    setName(""); setTitlePrefix("");
  }

  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;
  const priorityLabel = (key: string) => priorities.find((p) => p.key === key)?.label ?? key;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-neutral-800">Issue templates</h2>
      <p className="mb-3 text-xs text-neutral-500">One-click starting points shown on the quick-create form (title prefix + type + priority).</p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Bug report)"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <input
          value={titlePrefix}
          onChange={(e) => setTitlePrefix(e.target.value)}
          placeholder="Title prefix (e.g. [Bug] )"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          {priorities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <button onClick={add} disabled={pending || !name.trim()} className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40">
          Add template
        </button>
      </div>
      <ul className="space-y-1.5">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 text-sm">
            <span className="text-neutral-800">
              {t.name} <span className="text-xs text-neutral-400">· {typeLabel(t.type)} · {priorityLabel(t.priority)}{t.title_prefix ? ` · "${t.title_prefix}"` : ""}</span>
            </span>
            <button onClick={() => run(() => deleteIssueTemplateAction(slug, t.id))} className="text-xs text-red-600 hover:underline">Delete</button>
          </li>
        ))}
        {templates.length === 0 && <li className="text-sm text-neutral-400">No issue templates yet.</li>}
      </ul>
    </div>
  );
}

function FieldSection({
  title, field, options, slug, run, pending, reorderable, children,
}: {
  title: string; field: FieldName; options: Option[]; slug: string;
  run: (fn: () => Promise<unknown>) => void; pending: boolean;
  reorderable?: boolean; children?: ReactNode;
}) {
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= options.length) return;
    const reordered = [...options];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    run(() => reorderOptionsAction(slug, field, reordered.map((o) => o.id)));
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        <AddInline placeholder={`New ${field}…`} onAdd={(v) => run(() => addOptionAction(slug, field, v))} pending={pending} />
      </div>
      <ul className="space-y-1.5">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 text-sm">
            <span className="flex items-center gap-2 text-neutral-800">
              {reorderable && (
                <span className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={pending || i === 0}
                    aria-label={`Move ${o.label} up`}
                    className="leading-none text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={pending || i === options.length - 1}
                    aria-label={`Move ${o.label} down`}
                    className="leading-none text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </span>
              )}
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
      {children}
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
