/**
 * One-shot import: Travli_Sprint_QA UI Enhancements tab → Forge (Travli tenant, WEB project)
 *
 * Run:  node scripts/import-ui-enhancements.mjs [--dry-run]
 *
 * Reads the spreadsheet via openpyxl (spawned via python3), then inserts into Supabase
 * using the service-role key (bypasses RLS, no API key needed).
 */

import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────
const SPREADSHEET = "/Users/mgiblin/Downloads/Travli_Sprint_QA Master 061326.xlsx";
const SHEET = "UI Enhancements";

const SUPABASE_URL = "https://leivufxfbunqawahpsss.supabase.co";
// Load from .env.local
const envRaw = readFileSync("/Users/mgiblin/Documents/bug-app/forge/.env.local", "utf8");
const SERVICE_KEY = envRaw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not found in .env.local");

const TRAVLI_TENANT_ID = "b71c57d9-23c7-4bfe-9db2-3d4ee7bd0b9b";
const WEB_PROJECT_ID   = "98603ead-676e-47fd-aded-92e9138fbe6b";
const MATT_USER_ID     = "c06c91de-8472-4eae-a1bd-55012e6c8052";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Priority / type mapping ──────────────────────────────────────────────────
function mapPriority(raw) {
  if (raw == null) return { priority: "medium", type: "feature" };
  const s = String(raw).trim().toLowerCase();
  if (s === "1" || s === "1d") return { priority: "medium", type: "feature" }; // 1D = quick-win, stays medium
  if (s === "1") return { priority: "high",   type: "feature" };
  if (s === "2") return { priority: "medium", type: "feature" };
  if (s === "3" || s === "4" || s === "5") return { priority: "low", type: "feature" };
  const isBug = s.includes("bug") || s === "critical" || s === "priority - bug";
  if (isBug) return { priority: "high", type: "bug" };
  return { priority: "medium", type: "feature" };
}

// Refined: 1 → high, 1D → medium
function mapPriorityFull(raw) {
  if (raw == null) return { priority: "medium", type: "feature" };
  const s = String(raw).trim();
  if (s === "1")   return { priority: "high",   type: "feature" };
  if (s === "1D")  return { priority: "medium", type: "feature" };
  if (s === "2")   return { priority: "medium", type: "feature" };
  if (["3","4","5"].includes(s)) return { priority: "low", type: "feature" };
  const low = s.toLowerCase();
  if (low.includes("bug") || low === "critical" || low === "priority - bug") {
    return { priority: "high", type: "bug" };
  }
  return { priority: "medium", type: "feature" };
}

// ── Read spreadsheet via python ──────────────────────────────────────────────
const pyScript = [
  "import json, openpyxl",
  `wb = openpyxl.load_workbook(${JSON.stringify(SPREADSHEET)}, data_only=True)`,
  `ws = wb[${JSON.stringify(SHEET)}]`,
  "rows = []",
  "for row in ws.iter_rows(min_row=2, values_only=True):",
  "    if any(v is not None for v in row[:7]):",
  "        rows.append(list(row[:7]))",
  "print(json.dumps(rows))",
].join("\n");

const pyTmp = join(tmpdir(), "forge_import.py");
writeFileSync(pyTmp, pyScript);
const rawRows = JSON.parse(execSync(`python3 ${pyTmp}`, { encoding: "utf8" }));
unlinkSync(pyTmp);
// Columns: 0=ID, 1=Category, 2=Sub-Category, 3=Description, 4=Priority, 5=DevStatus(drop), 6=UAT Notes

const rows = rawRows.map(r => ({
  id:          String(r[0] ?? "").trim(),
  category:    String(r[1] ?? "").trim(),
  subCategory: String(r[2] ?? "").trim(),
  description: String(r[3] ?? "").trim(),
  priority:    r[4],
  uatNotes:    r[6] != null && String(r[6]).trim() !== "-" ? String(r[6]).trim() : null,
}));

console.log(`Read ${rows.length} rows from spreadsheet`);

// ── Supabase client ──────────────────────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Build / resolve category hierarchy ──────────────────────────────────────
async function ensureCategories() {
  // Get existing Travli categories
  const { data: existing } = await sb
    .from("tenant_categories")
    .select("id, name, parent_id")
    .eq("tenant_id", TRAVLI_TENANT_ID);

  const byKey = new Map(); // "parent::child" or "parent" → id
  for (const c of existing ?? []) {
    if (c.parent_id == null) byKey.set(c.name, c.id);
    else {
      const parent = existing.find(p => p.id === c.parent_id);
      if (parent) byKey.set(`${parent.name}::${c.name}`, c.id);
    }
  }

  // Collect unique pairs from the sheet
  const pairs = [...new Set(rows.map(r => `${r.category}::${r.subCategory}`))];

  for (const pair of pairs) {
    const [cat, sub] = pair.split("::");

    // Ensure parent
    if (!byKey.has(cat)) {
      if (DRY_RUN) {
        console.log(`  [dry] CREATE parent category: ${cat}`);
        byKey.set(cat, `dry-parent-${cat}`);
      } else {
        const { data, error } = await sb
          .from("tenant_categories")
          .insert({ tenant_id: TRAVLI_TENANT_ID, name: cat, parent_id: null, position: 0 })
          .select("id")
          .single();
        if (error) throw new Error(`Failed to create category ${cat}: ${error.message}`);
        byKey.set(cat, data.id);
        console.log(`  Created parent category: ${cat} → ${data.id}`);
      }
    }

    // Ensure child
    if (!byKey.has(pair)) {
      const parentId = byKey.get(cat);
      if (DRY_RUN) {
        console.log(`  [dry] CREATE sub-category: ${cat} / ${sub}`);
        byKey.set(pair, `dry-child-${pair}`);
      } else {
        const { data, error } = await sb
          .from("tenant_categories")
          .insert({ tenant_id: TRAVLI_TENANT_ID, name: sub, parent_id: parentId, position: 0 })
          .select("id")
          .single();
        if (error) throw new Error(`Failed to create sub-category ${sub}: ${error.message}`);
        byKey.set(pair, data.id);
        console.log(`  Created sub-category: ${cat} / ${sub} → ${data.id}`);
      }
    }
  }

  return byKey;
}

// ── Get next issue number ────────────────────────────────────────────────────
async function getNextNumber() {
  const { data } = await sb
    .from("issues")
    .select("number")
    .eq("project_id", WEB_PROJECT_ID)
    .order("number", { ascending: false })
    .limit(1);
  return (data?.[0]?.number ?? 0) + 1;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN ? "\n=== DRY RUN — no writes ===" : "\n=== IMPORTING ===");

  console.log("\n→ Resolving categories...");
  const catMap = await ensureCategories();

  let nextNum = await getNextNumber();
  console.log(`\n→ Next issue number: WEB-${nextNum}`);

  let created = 0;
  let commented = 0;

  for (const row of rows) {
    const { priority, type } = mapPriorityFull(row.priority);
    const catKey = `${row.category}::${row.subCategory}`;
    const categoryId = catMap.get(catKey) ?? null;
    const title = `[${row.id}] [${row.category}] [${row.subCategory}]`;
    const issueNum = nextNum++;

    if (DRY_RUN) {
      console.log(`\n  [dry] WEB-${issueNum} | ${title}`);
      console.log(`         priority=${priority} type=${type} category=${catKey}`);
      console.log(`         desc: ${row.description.slice(0, 80)}${row.description.length > 80 ? "…" : ""}`);
      if (row.uatNotes) console.log(`         + UAT comment: ${row.uatNotes.slice(0, 80)}…`);
      continue;
    }

    // Insert issue
    const { data: issue, error: issueErr } = await sb
      .from("issues")
      .insert({
        tenant_id:   TRAVLI_TENANT_ID,
        project_id:  WEB_PROJECT_ID,
        number:      issueNum,
        title,
        description: row.description || null,
        status:      "todo",
        priority,
        type,
        assignee_id: MATT_USER_ID,
        reporter_id: MATT_USER_ID,
        category_id: categoryId,
        labels:      [],
        source:      "api",
        position:    issueNum,
      })
      .select("id")
      .single();

    if (issueErr) {
      console.error(`  ERROR on ${title}: ${issueErr.message}`);
      continue;
    }

    created++;
    console.log(`  ✓ WEB-${issueNum} | ${title}`);

    // UAT comment
    if (row.uatNotes) {
      const { error: cmtErr } = await sb
        .from("issue_comments")
        .insert({
          tenant_id:    TRAVLI_TENANT_ID,
          issue_id:     issue.id,
          author_id:    null,
          author_label: "UAT Testing Notes",
          body:         row.uatNotes,
        });

      if (cmtErr) {
        console.error(`    WARNING: comment failed for WEB-${issueNum}: ${cmtErr.message}`);
      } else {
        commented++;
      }
    }
  }

  console.log(`\n✓ Done. Created ${created} issues, ${commented} UAT comments.`);
}

main().catch(err => { console.error(err); process.exit(1); });
