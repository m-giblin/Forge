/**
 * Bulk issue importer (Phase 3). Reads a CSV and creates issues in a tenant,
 * validating status/priority/type against that tenant's configured options and
 * find-or-creating Category → Sub-Category. Idempotent via an external_id column.
 *
 * DRY-RUN by default (writes nothing). Add --apply to actually insert.
 *
 *   node --env-file=.env.local scripts/import-issues.mjs <tenantSlug> <file.csv> [--apply]
 *
 * Recognized CSV headers (case-insensitive; only `title` is required):
 *   title, description, type, priority, status, category, subcategory, external_id
 * Values for type/priority/status may be the option's key OR its label.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [slug, file] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
if (!URL || !SERVICE || !slug || !file) {
  console.error("Usage: node --env-file=.env.local scripts/import-issues.mjs <tenantSlug> <file.csv> [--apply]");
  process.exit(1);
}
const a = createClient(URL, SERVICE, { auth: { persistSession: false } });

// Minimal RFC-4180 CSV parser (handles quotes, embedded commas/newlines).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, inQ = false;
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

(async () => {
  const { data: tenant } = await a.from("tenants").select("id, name").eq("slug", slug).maybeSingle();
  if (!tenant) throw new Error(`No tenant "${slug}".`);

  const { data: project } = await a.from("projects").select("id, key").eq("tenant_id", tenant.id).order("created_at").limit(1).maybeSingle();
  if (!project) throw new Error(`Tenant "${slug}" has no project.`);

  const { data: options } = await a.from("tenant_field_options").select("field, key, label").eq("tenant_id", tenant.id);
  const { data: cats } = await a.from("tenant_categories").select("id, parent_id, name").eq("tenant_id", tenant.id);

  // Resolve a CSV value to a configured key (match key or label, case-insensitive).
  const resolve = (field, value) => {
    if (!value) return { key: null };
    const v = value.trim().toLowerCase();
    const hit = (options || []).find((o) => o.field === field && (o.key.toLowerCase() === v || o.label.toLowerCase() === v));
    return hit ? { key: hit.key } : { key: null, invalid: value };
  };
  const def = (field) => (options || []).find((o) => o.field === field && o.label) && // any exists
    ((options || []).find((o) => o.field === field) ? ((options.find((o) => o.field === field && o.is_default) || options.find((o) => o.field === field))?.key) : null);

  // mutable category cache (find-or-create during apply)
  const catList = [...(cats || [])];
  async function resolveCategory(catName, subName) {
    if (!catName) return null;
    let top = catList.find((c) => !c.parent_id && c.name.toLowerCase() === catName.trim().toLowerCase());
    if (!top) {
      if (!APPLY) { top = { id: `(new:${catName})`, parent_id: null, name: catName.trim() }; catList.push(top); }
      else { const { data } = await a.from("tenant_categories").insert({ tenant_id: tenant.id, parent_id: null, name: catName.trim() }).select("id,parent_id,name").single(); top = data; catList.push(top); }
    }
    if (!subName) return top.id;
    let sub = catList.find((c) => c.parent_id === top.id && c.name.toLowerCase() === subName.trim().toLowerCase());
    if (!sub) {
      if (!APPLY) { sub = { id: `(new:${catName}/${subName})`, parent_id: top.id, name: subName.trim() }; catList.push(sub); }
      else { const { data } = await a.from("tenant_categories").insert({ tenant_id: tenant.id, parent_id: top.id, name: subName.trim() }).select("id,parent_id,name").single(); sub = data; catList.push(sub); }
    }
    return sub.id;
  }

  const raw = parseCSV(readFileSync(file, "utf8"));
  if (raw.length < 2) throw new Error("CSV has no data rows.");
  const headers = raw[0].map((h) => h.trim().toLowerCase());
  const col = (name) => headers.indexOf(name);
  const ix = {
    title: col("title"), description: col("description"), type: col("type"), priority: col("priority"),
    status: col("status"), category: col("category"), subcategory: col("subcategory"), external_id: col("external_id"),
  };
  if (ix.title === -1) throw new Error("CSV must have a 'title' column.");

  let created = 0, skipped = 0;
  const errors = [];
  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN"} — import into ${tenant.name} (/${slug}), project ${project.key}\n`);

  for (let r = 1; r < raw.length; r++) {
    const get = (k) => (ix[k] >= 0 ? (raw[r][ix[k]] ?? "").trim() : "");
    const title = get("title");
    if (!title) { errors.push(`row ${r + 1}: missing title`); continue; }

    const rowErrors = [];
    const st = get("status") ? resolve("status", get("status")) : { key: def("status") };
    const pr = get("priority") ? resolve("priority", get("priority")) : { key: def("priority") };
    const ty = get("type") ? resolve("type", get("type")) : { key: def("type") };
    if (st.invalid) rowErrors.push(`unknown status "${st.invalid}"`);
    if (pr.invalid) rowErrors.push(`unknown priority "${pr.invalid}"`);
    if (ty.invalid) rowErrors.push(`unknown type "${ty.invalid}"`);
    if (rowErrors.length) { errors.push(`row ${r + 1} (${title}): ${rowErrors.join(", ")}`); continue; }

    const extId = get("external_id") || null;
    if (extId) {
      const { data: dup } = await a.from("issues").select("id").eq("tenant_id", tenant.id).eq("external_id", extId).maybeSingle();
      if (dup) { skipped++; console.log(`  ⏭  skip (exists): ${extId} — ${title}`); continue; }
    }
    const categoryId = await resolveCategory(get("category"), get("subcategory"));

    if (APPLY) {
      const { error } = await a.from("issues").insert({
        tenant_id: tenant.id, project_id: project.id, title,
        description: get("description") || null,
        status: st.key, priority: pr.key, type: ty.key,
        category_id: typeof categoryId === "string" && categoryId.startsWith("(new") ? null : categoryId,
        external_id: extId, source: "api",
      });
      if (error) { errors.push(`row ${r + 1} (${title}): ${error.message}`); continue; }
    }
    created++;
    console.log(`  ${APPLY ? "✅" : "•"} ${ty.key}/${pr.key}/${st.key}${get("category") ? ` [${get("category")}${get("subcategory") ? "/" + get("subcategory") : ""}]` : ""} — ${title}`);
  }

  console.log(`\n${APPLY ? "Imported" : "Would import"}: ${created}   skipped(existing): ${skipped}   errors: ${errors.length}`);
  if (errors.length) { console.log("\nERRORS:"); errors.forEach((e) => console.log("  ✗ " + e)); }
  if (!APPLY) console.log("\n(dry run — nothing written. Re-run with --apply to commit.)\n");
})().catch((e) => { console.error("\nIMPORT ERROR:", e.message); process.exit(1); });
