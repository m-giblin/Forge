"use server";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";

export type ImportRow = {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  type?: string;
  category?: string;
  subcategory?: string;
  external_id?: string | null;
};

export type NewCategory = {
  name: string;
  parentName: string | null;
};

export type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export async function importIssuesAction(
  slug: string,
  projectId: string,
  rows: ImportRow[],
  createCategories: NewCategory[]
): Promise<ImportResult> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized.");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admin only.");

  const svc = createSupabaseServiceClient();
  const cfg = fieldConfigRepo(svc);

  const [options, existingCats] = await Promise.all([
    cfg.listOptions(ctx.tenant.id),
    cfg.listCategories(ctx.tenant.id),
  ]);

  const { data: project } = await svc
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("tenant_id", ctx.tenant.id)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");

  const resolveOpt = (field: string, value: string | undefined): string | null => {
    if (!value?.trim()) return null;
    const v = value.trim().toLowerCase();
    return options.find((o) => o.field === field && (o.key.toLowerCase() === v || o.label.toLowerCase() === v))?.key ?? null;
  };

  const defaultOpt = (field: string): string =>
    options.find((o) => o.field === field && o.is_default)?.key ??
    options.find((o) => o.field === field)?.key ??
    (field === "status" ? "todo" : field === "priority" ? "medium" : "bug");

  // Create new categories — parents first, then subs.
  const catList = [...existingCats];
  for (const cat of createCategories.filter((c) => c.parentName === null)) {
    const exists = catList.find((c) => !c.parent_id && c.name.toLowerCase() === cat.name.toLowerCase());
    if (!exists) {
      const { data } = await svc
        .from("tenant_categories")
        .insert({ tenant_id: ctx.tenant.id, parent_id: null, name: cat.name })
        .select("id, parent_id, name")
        .single();
      if (data) catList.push(data as (typeof catList)[0]);
    }
  }
  for (const cat of createCategories.filter((c) => c.parentName !== null)) {
    const parent = catList.find((c) => !c.parent_id && c.name.toLowerCase() === cat.parentName!.toLowerCase());
    if (!parent) continue;
    const exists = catList.find((c) => c.parent_id === parent.id && c.name.toLowerCase() === cat.name.toLowerCase());
    if (!exists) {
      const { data } = await svc
        .from("tenant_categories")
        .insert({ tenant_id: ctx.tenant.id, parent_id: parent.id, name: cat.name })
        .select("id, parent_id, name")
        .single();
      if (data) catList.push(data as (typeof catList)[0]);
    }
  }

  const resolveCategory = (catName?: string, subName?: string): string | null => {
    if (!catName?.trim()) return null;
    const top = catList.find((c) => !c.parent_id && c.name.toLowerCase() === catName.trim().toLowerCase());
    if (!top) return null;
    if (!subName?.trim()) return top.id;
    const sub = catList.find((c) => c.parent_id === top.id && c.name.toLowerCase() === subName.trim().toLowerCase());
    return sub?.id ?? top.id;
  };

  // Batch-check existing external_ids to avoid N queries.
  const extIds = rows.map((r) => r.external_id).filter(Boolean) as string[];
  const existingExtIds = new Set<string>();
  if (extIds.length > 0) {
    const { data: dups } = await svc
      .from("issues")
      .select("external_id")
      .eq("tenant_id", ctx.tenant.id)
      .in("external_id", extIds);
    dups?.forEach((d) => { if (d.external_id) existingExtIds.add(d.external_id); });
  }

  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.title?.trim()) {
      result.errors.push({ row: rowNum, message: "Missing title" });
      continue;
    }

    if (row.external_id && existingExtIds.has(row.external_id)) {
      result.skipped++;
      continue;
    }

    if (row.status && !resolveOpt("status", row.status)) {
      result.errors.push({ row: rowNum, message: `Unknown status "${row.status}"` });
      continue;
    }
    if (row.priority && !resolveOpt("priority", row.priority)) {
      result.errors.push({ row: rowNum, message: `Unknown priority "${row.priority}"` });
      continue;
    }
    if (row.type && !resolveOpt("type", row.type)) {
      result.errors.push({ row: rowNum, message: `Unknown type "${row.type}"` });
      continue;
    }

    const category_id = resolveCategory(row.category, row.subcategory);
    if (row.category?.trim() && !category_id) {
      result.skipped++;
      continue;
    }

    const { error } = await svc.from("issues").insert({
      tenant_id: ctx.tenant.id,
      project_id: projectId,
      title: row.title.trim(),
      description: row.description?.trim() || null,
      status: resolveOpt("status", row.status) ?? defaultOpt("status"),
      priority: resolveOpt("priority", row.priority) ?? defaultOpt("priority"),
      type: resolveOpt("type", row.type) ?? defaultOpt("type"),
      category_id,
      custom_values: {},
      reporter_id: null,
      source: "web",
      external_id: row.external_id?.trim() || null,
      labels: [],
    });

    if (error) {
      result.errors.push({ row: rowNum, message: error.message });
    } else {
      result.created++;
    }
  }

  return result;
}
