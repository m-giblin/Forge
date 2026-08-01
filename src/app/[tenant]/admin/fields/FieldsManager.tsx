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
import AdminList from "@/components/patterns/admin/AdminList";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import Toggle from "@/components/patterns/Toggle";

type Option = { id: string; field: FieldName; key: string; label: string; is_default: boolean };
type Category = { id: string; parent_id: string | null; name: string };
type Component = { id: string; name: string };
type CustomField = { id: string; key: string; label: string; type: CustomFieldType; options: string[]; required: boolean };
type Schema = {
  statuses: Option[]; priorities: Option[]; types: Option[]; categories: Category[]; components: Component[]; customFields: CustomField[];
  restrictStatusTransitions: boolean;
};

const inputClass =
  "rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[6px] text-[12px] text-[#20201d] outline-none focus:border-[#b7452f]";

const TYPE_CHIP: Record<CustomFieldType, { fg: string; bg: string }> = {
  text: { fg: "#4a473e", bg: "#f1efe9" },
  number: { fg: "#4a473e", bg: "#f1efe9" },
  select: { fg: "#2f5f8f", bg: "#e2ecf5" },
  date: { fg: "#2f5f8f", bg: "#e2ecf5" },
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

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className={`space-y-4 ${readOnly ? "pointer-events-none opacity-70" : ""}`}>
      {error && <p className="rounded-[6px] border border-[#f0cfc9] bg-[#fbeae8] px-3 py-2 text-[11.5px] text-[#a13a2f]">{error}</p>}

      {/* Summary */}
      <AdminList
        items={[
          {
            key: "categories",
            title: "Categories",
            subline: tops.length > 0 ? tops.map((c) => c.name).join(", ") : "No categories yet",
            meta: `${tops.length} categor${tops.length === 1 ? "y" : "ies"}`,
            actionLabel: "Manage",
            onAction: () => scrollTo("categories-section"),
          },
          {
            key: "components",
            title: "Components",
            subline: schema.components.length > 0 ? schema.components.map((c) => c.name).join(", ") : "No components yet",
            meta: `${schema.components.length} component${schema.components.length === 1 ? "" : "s"}`,
            actionLabel: "Manage",
            onAction: () => scrollTo("components-section"),
          },
          {
            key: "templates",
            title: "Issue templates",
            subline: templates.length > 0 ? templates.map((t) => t.name).join(", ") : "No templates yet",
            meta: `${templates.length} template${templates.length === 1 ? "" : "s"}`,
            actionLabel: "Manage",
            onAction: () => scrollTo("templates-section"),
          },
        ]}
      />

      <FieldSection title="Statuses" field="status" options={schema.statuses} slug={slug} run={run} pending={pending} reorderable>
        <label className="mt-3 flex items-start gap-2.5 rounded-[6px] bg-[#f4f2eb] px-3 py-2.5 text-[11.5px] text-[#4a473e]">
          <Toggle on={restrict} onChange={toggleRestrict} label="Restrict status transitions" />
          <span>
            <span className="font-semibold text-[#20201d]">Restrict status changes to adjacent workflow steps.</span>{" "}
            When on, an issue can only move to the status directly before or after its current one in the order above — no skipping steps.
          </span>
        </label>
      </FieldSection>
      <FieldSection title="Priorities" field="priority" options={schema.priorities} slug={slug} run={run} pending={pending} reorderable />
      <FieldSection title="Types" field="type" options={schema.types} slug={slug} run={run} pending={pending} reorderable />

      {/* Categories */}
      <div id="categories-section" className="fw-card p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[12.5px] font-bold text-[#20201d]">Categories</h2>
          <AddInline placeholder="New category…" onAdd={(v) => run(() => addCategoryAction(slug, v, null))} pending={pending} />
        </div>
        {tops.length === 0 && <p className="text-[11.5px] text-[#a19d90]">No categories yet.</p>}
        <ul className="space-y-3">
          {tops.map((cat) => (
            <li key={cat.id}>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-[#20201d]">{cat.name}</span>
                <button onClick={() => run(() => deleteCategoryAction(slug, cat.id))} className="text-[11px] font-semibold text-[#a13a2f] hover:underline">
                  Delete
                </button>
              </div>
              <ul className="ml-4 mt-1 space-y-1 border-l border-[#e3ded0] pl-3">
                {childrenOf(cat.id).map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between text-[11.5px]">
                    <span className="text-[#726e60]">{sub.name}</span>
                    <button onClick={() => run(() => deleteCategoryAction(slug, sub.id))} className="text-[11px] font-semibold text-[#a13a2f] hover:underline">
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
    <div id="components-section" className="fw-card p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12.5px] font-bold text-[#20201d]">Components</h2>
          <p className="text-[11.5px] text-[#726e60]">Tag issues by the part of the product they touch — e.g. Auth, Billing, Mobile.</p>
        </div>
        <AddInline placeholder="New component…" onAdd={(v) => run(() => addComponentAction(slug, v))} pending={pending} />
      </div>
      <ul className="space-y-1.5">
        {components.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-[5px] bg-[#f4f2eb] px-3 py-1.5 text-[12px]">
            <span className="text-[#20201d]">{c.name}</span>
            <button onClick={() => run(() => deleteComponentAction(slug, c.id))} className="text-[11px] font-semibold text-[#a13a2f] hover:underline">Delete</button>
          </li>
        ))}
        {components.length === 0 && <li className="text-[11.5px] text-[#a19d90]">No components yet.</li>}
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

  const rows: AdminTableCell[][] = fields.map((f) => [
    { kind: "text", value: f.label },
    { kind: "chip", value: f.type.charAt(0).toUpperCase() + f.type.slice(1), chipFg: TYPE_CHIP[f.type].fg, chipBg: TYPE_CHIP[f.type].bg },
    { kind: "dim", value: f.type === "select" && f.options.length ? f.options.join(", ") : "—" },
    { kind: "link", value: "Delete", onClick: () => run(() => deleteCustomFieldAction(slug, f.id)) },
  ]);

  return (
    <div className="space-y-3">
      <h2 className="text-[12.5px] font-bold text-[#20201d]">Custom fields</h2>
      <p className="-mt-2 text-[11.5px] text-[#726e60]">Extra fields captured on every issue, defined however your team tracks work.</p>

      <div className="fw-card flex flex-wrap items-end gap-2 p-3.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Field name (e.g. Severity)"
          className={`flex-1 ${inputClass}`}
        />
        <select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)} className={inputClass}>
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
            className={inputClass}
          />
        )}
        <label className="flex items-center gap-1.5 text-[11.5px] text-[#4a473e]">
          <Toggle on={required} onChange={setRequired} label="Required" /> Required
        </label>
        <button
          onClick={add}
          disabled={pending || !label.trim()}
          className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-40"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-[11.5px] text-[#a19d90]">No custom fields yet.</p>
      ) : (
        <AdminTable
          columns={[
            { label: "Custom field", flex: true },
            { label: "Type", width: 150 },
            { label: "Options", width: 260 },
            { label: "", width: 90 },
          ]}
          rows={rows}
        />
      )}
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
    <div id="templates-section" className="fw-card p-3.5">
      <h2 className="mb-1 text-[12.5px] font-bold text-[#20201d]">Issue templates</h2>
      <p className="mb-3 text-[11.5px] text-[#726e60]">One-click starting points shown on the quick-create form (title prefix + type + priority).</p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Bug report)"
          className={`flex-1 ${inputClass}`}
        />
        <input
          value={titlePrefix}
          onChange={(e) => setTitlePrefix(e.target.value)}
          placeholder="Title prefix (e.g. [Bug] )"
          className={inputClass}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
          {priorities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-40"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          Add template
        </button>
      </div>
      <ul className="space-y-1.5">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-[5px] bg-[#f4f2eb] px-3 py-1.5 text-[12px]">
            <span className="text-[#20201d]">
              {t.name} <span className="text-[11px] text-[#a19d90]">· {typeLabel(t.type)} · {priorityLabel(t.priority)}{t.title_prefix ? ` · "${t.title_prefix}"` : ""}</span>
            </span>
            <button onClick={() => run(() => deleteIssueTemplateAction(slug, t.id))} className="text-[11px] font-semibold text-[#a13a2f] hover:underline">Delete</button>
          </li>
        ))}
        {templates.length === 0 && <li className="text-[11.5px] text-[#a19d90]">No issue templates yet.</li>}
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
    <div className="fw-card p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12.5px] font-bold text-[#20201d]">{title}</h2>
        <AddInline placeholder={`New ${field}…`} onAdd={(v) => run(() => addOptionAction(slug, field, v))} pending={pending} />
      </div>
      <ul className="space-y-1.5">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-center justify-between rounded-[5px] bg-[#f4f2eb] px-3 py-1.5 text-[12px]">
            <span className="flex items-center gap-2 text-[#20201d]">
              {reorderable && (
                <span className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={pending || i === 0}
                    aria-label={`Move ${o.label} up`}
                    className="leading-none text-[#a19d90] hover:text-[#4a473e] disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={pending || i === options.length - 1}
                    aria-label={`Move ${o.label} down`}
                    className="leading-none text-[#a19d90] hover:text-[#4a473e] disabled:opacity-30"
                  >
                    ▼
                  </button>
                </span>
              )}
              {o.label}
              {o.is_default && <span className="ml-2 rounded-[4px] bg-[#e3ded0] px-1.5 py-0.5 text-[10px] font-semibold text-[#726e60]">default</span>}
            </span>
            <span className="flex items-center gap-3">
              {!o.is_default && (
                <button onClick={() => run(() => setDefaultAction(slug, o.id, field))} className="text-[11px] font-semibold text-[#726e60] hover:underline">
                  Make default
                </button>
              )}
              <button onClick={() => run(() => deleteOptionAction(slug, o.id))} className="text-[11px] font-semibold text-[#a13a2f] hover:underline">
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
        className={`rounded-[5px] border border-[#ddd8c9] bg-white px-2 py-1 outline-none focus:border-[#b7452f] ${small ? "text-[11px]" : "text-[12px]"}`}
      />
      <button
        onClick={submit}
        disabled={pending || !v.trim()}
        className={`rounded-[5px] bg-[#20201d] px-2.5 py-1 font-semibold text-white hover:bg-[#3a3a35] disabled:opacity-40 ${small ? "text-[11px]" : "text-[12px]"}`}
      >
        Add
      </button>
    </div>
  );
}
