import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  fieldConfigRepo,
  type FieldName,
  type FieldOption,
  type Category,
  type Component,
  type CustomField,
  type CustomFieldType,
} from "@/lib/repositories/fieldConfig";
import { issuesRepo } from "@/lib/repositories/issues";

export type TenantSchema = {
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  components: Component[];
  customFields: CustomField[];
  restrictStatusTransitions: boolean;
};

function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

/**
 * Custom fields are tolerant of migration 0008 not being applied yet: if the
 * table doesn't exist, return [] so the board/Fields page keep working (no
 * behavior change until the migration runs).
 */
export async function safeListCustomFields(supabase: SupabaseClient, tenantId: string): Promise<CustomField[]> {
  try {
    return await fieldConfigRepo(supabase).listCustomFields(tenantId);
  } catch (e) {
    // Table not yet created (migration 0008 not run). PostgREST reports
    // "PGRST205" (not in schema cache); raw Postgres would be "42P01".
    const code = (e as { code?: string })?.code;
    if (code === "PGRST205" || code === "42P01") return [];
    throw e;
  }
}

/**
 * Components are tolerant of migration 0125 not being applied yet: if the
 * table doesn't exist, return [] so the board/Fields page keep working (no
 * behavior change until the migration runs) — same pattern as
 * safeListCustomFields above.
 */
export async function safeListComponents(supabase: SupabaseClient, tenantId: string): Promise<Component[]> {
  try {
    return await fieldConfigRepo(supabase).listComponents(tenantId);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "PGRST205" || code === "42P01") return [];
    throw e;
  }
}

/** All config for a tenant, grouped. `impersonating` → service-role (support view). */
export async function getTenantSchema(tenantId: string, impersonating = false, projectId?: string): Promise<TenantSchema> {
  const supabase = impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  const [options, categories, components, customFields, tenantRow] = await Promise.all([
    repo.listOptions(tenantId),
    repo.listCategories(tenantId, projectId),
    safeListComponents(supabase, tenantId),
    safeListCustomFields(supabase, tenantId),
    supabase.from("tenants").select("restrict_status_transitions").eq("id", tenantId).maybeSingle(),
  ]);
  return {
    statuses: options.filter((o) => o.field === "status"),
    priorities: options.filter((o) => o.field === "priority"),
    types: options.filter((o) => o.field === "type"),
    categories,
    components,
    customFields,
    restrictStatusTransitions: !!tenantRow.data?.restrict_status_transitions,
  };
}

const MAX_OPTIONS_PER_FIELD = 15;
const MAX_CUSTOM_FIELDS = 50;

export async function addCustomField(
  tenantId: string,
  input: { label: string; type: CustomFieldType; options: string[]; required: boolean }
): Promise<void> {
  if (!input.label.trim()) throw new Error("Label is required.");
  const key = slugify(input.label);
  if (!key) throw new Error("Label must contain letters or numbers.");
  const supabase = await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  const existing = await repo.listCustomFields(tenantId);
  if (existing.length >= MAX_CUSTOM_FIELDS)
    throw new Error(`Workspaces are limited to ${MAX_CUSTOM_FIELDS} custom fields.`);
  if (existing.some((f) => f.key === key)) throw new Error(`A field called "${input.label}" already exists.`);
  await repo.addCustomField({
    tenant_id: tenantId,
    key,
    label: input.label.trim(),
    type: input.type,
    options: input.type === "select" ? input.options.filter((o) => o.trim()) : [],
    required: input.required,
    position: existing.length,
  });
}

export async function deleteCustomField(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await fieldConfigRepo(supabase).deleteCustomField(tenantId, id);
}

export async function addFieldOption(tenantId: string, field: FieldName, label: string): Promise<void> {
  if (!label.trim()) throw new Error("Label is required.");
  const key = slugify(label);
  if (!key) throw new Error("Label must contain letters or numbers.");
  const supabase = await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  const existing = (await repo.listOptions(tenantId)).filter((o) => o.field === field);
  if (existing.length >= MAX_OPTIONS_PER_FIELD)
    throw new Error(`Workspaces are limited to ${MAX_OPTIONS_PER_FIELD} ${field} options.`);
  if (existing.some((o) => o.key === key)) throw new Error(`A ${field} called "${label}" already exists.`);
  await repo.addOption({
    tenant_id: tenantId, field, key, label: label.trim(), color: null, position: existing.length,
  });
}

export async function deleteFieldOption(tenantId: string, id: string): Promise<void> {
  // Guards: not the last option, not the default, and NOT in use by any issue
  // (deleting an in-use value would orphan those issues — review finding #4).
  const supabase = await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  const all = await repo.listOptions(tenantId);
  const target = all.find((o) => o.id === id);
  if (!target) return;
  const peers = all.filter((o) => o.field === target.field);
  if (peers.length <= 1) throw new Error(`A workspace needs at least one ${target.field}.`);
  if (target.is_default) throw new Error("Pick another default before deleting this one.");

  // In-use check: target.field is the issues column ('status'|'priority'|'type').
  const count = await issuesRepo(supabase).countByField(tenantId, target.field, target.key);
  if (count > 0) {
    throw new Error(
      `${count} issue${count === 1 ? "" : "s"} still use the "${target.label}" ${target.field}. Reassign them before deleting it.`
    );
  }

  await repo.deleteOption(tenantId, id);
}

export async function setDefaultOption(tenantId: string, id: string, field: FieldName): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  await repo.clearDefault(tenantId, field);
  await repo.setDefault(tenantId, id);
}

/** Reorder one field's options top-to-bottom. `orderedIds` must be exactly that field's option ids (any order lost otherwise). */
export async function reorderFieldOptions(tenantId: string, field: FieldName, orderedIds: string[]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  const existing = (await repo.listOptions(tenantId)).filter((o) => o.field === field);
  const existingIds = new Set(existing.map((o) => o.id));
  if (orderedIds.length !== existing.length || orderedIds.some((id) => !existingIds.has(id))) {
    throw new Error("Reorder list doesn't match this workspace's current options.");
  }
  await repo.reorderOptions(tenantId, orderedIds);
}

/** Tenant-wide toggle: when on, an issue's status can only move to an adjacent workflow step (by position). */
export async function getRestrictStatusTransitions(tenantId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("tenants").select("restrict_status_transitions").eq("id", tenantId).maybeSingle();
  return !!data?.restrict_status_transitions;
}

export async function setRestrictStatusTransitions(tenantId: string, value: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenants").update({ restrict_status_transitions: value }).eq("id", tenantId);
  if (error) throw error;
}

const MAX_COMPONENTS = 50;

export async function addComponent(tenantId: string, name: string): Promise<void> {
  if (!name.trim()) throw new Error("Name is required.");
  const supabase = await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  const existing = await repo.listComponents(tenantId);
  if (existing.length >= MAX_COMPONENTS) throw new Error(`Workspaces are limited to ${MAX_COMPONENTS} components.`);
  if (existing.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
    throw new Error(`A component called "${name.trim()}" already exists.`);
  }
  await repo.addComponent({ tenant_id: tenantId, name: name.trim(), position: existing.length });
}

export async function deleteComponent(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await fieldConfigRepo(supabase).deleteComponent(tenantId, id);
}

export async function addCategory(tenantId: string, name: string, parentId: string | null, projectId?: string | null): Promise<void> {
  if (!name.trim()) throw new Error("Name is required.");
  const supabase = await createSupabaseServerClient();
  await fieldConfigRepo(supabase).addCategory({ tenant_id: tenantId, project_id: projectId ?? null, parent_id: parentId, name: name.trim() });
}

export async function deleteCategory(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await fieldConfigRepo(supabase).deleteCategory(tenantId, id);
}

export type CsvCategoryRow = { name: string; parent_name: string };

export async function importCategories(
  tenantId: string,
  projectId: string,
  rows: CsvCategoryRow[],
  replace: boolean,
): Promise<{ created: number; errors: string[] }> {
  const supabase = await createSupabaseServerClient();
  const repo = fieldConfigRepo(supabase);
  const errors: string[] = [];

  if (replace) await repo.deleteCategoriesByProject(tenantId, projectId);

  // First pass: insert top-level categories
  const tops = rows.filter((r) => !r.parent_name.trim());
  const topInserts = tops.map((r, i) => ({
    tenant_id: tenantId, project_id: projectId, parent_id: null, name: r.name.trim(), position: i,
  }));
  const topRows = topInserts.length > 0 ? await repo.bulkAddCategories(topInserts) : [];
  const topMap = new Map(topRows.map((r) => [r.name, r.id]));

  // Second pass: insert sub-categories
  const subs = rows.filter((r) => r.parent_name.trim());
  const subInserts: { tenant_id: string; project_id: string; parent_id: string | null; name: string; position: number }[] = [];
  subs.forEach((r, i) => {
    const parentId = topMap.get(r.parent_name.trim());
    if (!parentId) { errors.push(`Unknown parent "${r.parent_name}" for sub-category "${r.name}"`); return; }
    subInserts.push({ tenant_id: tenantId, project_id: projectId, parent_id: parentId, name: r.name.trim(), position: i });
  });
  if (subInserts.length > 0) await repo.bulkAddCategories(subInserts);

  return { created: topRows.length + subInserts.length, errors };
}
