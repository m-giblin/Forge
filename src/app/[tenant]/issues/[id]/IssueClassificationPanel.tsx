"use client";

import { SideGroupLabel, InfoTooltip, sidebarSelect, sideLabel } from "./IssueDetailUI";
import type { FieldOption, CustomField, Component } from "@/lib/repositories/fieldConfig";
import type { IssuePatch } from "@/lib/services/issues";

export default function IssueClassificationPanel({
  priority,
  type,
  categoryId,
  componentId,
  priorities,
  types,
  catOptions,
  components,
  customFields,
  customValues,
  readOnly,
  setPriority,
  setType,
  setCategoryId,
  setComponentId,
  setCustomValues,
  saveField,
}: {
  priority: string;
  type: string;
  categoryId: string;
  componentId: string;
  priorities: FieldOption[];
  types: FieldOption[];
  catOptions: { id: string; label: string }[];
  components: Component[];
  customFields: CustomField[];
  customValues: Record<string, string>;
  readOnly: boolean;
  setPriority: (v: string) => void;
  setType: (v: string) => void;
  setCategoryId: (v: string) => void;
  setComponentId: (v: string) => void;
  setCustomValues: (fn: (cv: Record<string, string>) => Record<string, string>) => void;
  saveField: (patch: IssuePatch) => void;
}) {
  return (
    <div className="rounded-xl border border-[#ddd8c9] bg-[#f4f2eb] p-4 space-y-3">
      <SideGroupLabel color="text-[#b7452f]">🏷 Classification</SideGroupLabel>
      <div>
        <p className={sideLabel}>
          Priority
          <InfoTooltip text="How urgently this issue needs to be resolved. Urgent = blocking production now. High = must ship this sprint. Medium = important but not blocking. Low = nice to have." />
        </p>
        <select value={priority} disabled={readOnly} onChange={(e) => { setPriority(e.target.value); saveField({ priority: e.target.value }); }} className={sidebarSelect}>
          {priorities.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <p className={sideLabel}>
          Type
          <InfoTooltip text="What kind of work this is. Bug = something broken. Feature = new functionality. Task = operational work. Chore = maintenance with no user impact." />
        </p>
        <select value={type} disabled={readOnly} onChange={(e) => { setType(e.target.value); saveField({ type: e.target.value }); }} className={sidebarSelect}>
          {types.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      {catOptions.length > 0 && (
        <div>
          <p className={sideLabel}>
            Category
            <InfoTooltip text="A custom label your team uses to group related issues — e.g. Auth, Billing, Performance. Set by your project admin." />
          </p>
          <select value={categoryId} disabled={readOnly} onChange={(e) => { setCategoryId(e.target.value); saveField({ categoryId: e.target.value || null }); }} className={sidebarSelect}>
            <option value="">None</option>
            {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}
      {components.length > 0 && (
        <div>
          <p className={sideLabel}>
            Component
            <InfoTooltip text="The part of the product this issue touches — e.g. Auth, Billing, Mobile. Set by your workspace admin." />
          </p>
          <select value={componentId} disabled={readOnly} onChange={(e) => { setComponentId(e.target.value); saveField({ componentId: e.target.value || null }); }} className={sidebarSelect}>
            <option value="">None</option>
            {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {customFields.map((f) => (
        <div key={f.key}>
          <p className={sideLabel}>
            {f.label}
            {f.key === "severity" && (
              <InfoTooltip text="How severely this impacts end users. Critical = data loss or outage. High = major feature broken. Medium = degraded experience. Low = cosmetic or minor." />
            )}
            {f.required && <span className="text-[#c0392b]"> *</span>}
          </p>
          {f.type === "select" ? (
            <select
              value={customValues[f.key] ?? ""}
              disabled={readOnly}
              onChange={(e) => { const v = e.target.value; setCustomValues((cv) => ({ ...cv, [f.key]: v })); saveField({ customValues: { ...customValues, [f.key]: v } }); }}
              className={sidebarSelect}
            >
              <option value="">—</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              value={customValues[f.key] ?? ""}
              disabled={readOnly}
              onChange={(e) => setCustomValues((cv) => ({ ...cv, [f.key]: e.target.value }))}
              onBlur={(e) => saveField({ customValues: { ...customValues, [f.key]: e.target.value } })}
              className={sidebarSelect}
            />
          )}
        </div>
      ))}
    </div>
  );
}
