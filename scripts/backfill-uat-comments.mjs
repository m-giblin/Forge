/**
 * Backfill UAT comments onto the 21 WEB issues that have non-empty UAT notes.
 * Matches by title (which contains the spreadsheet ID like [JG65]).
 */

import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SPREADSHEET = "/Users/mgiblin/Downloads/Travli_Sprint_QA Master 061326.xlsx";
const SHEET = "UI Enhancements";
const SUPABASE_URL = "https://leivufxfbunqawahpsss.supabase.co";
const envRaw = readFileSync("/Users/mgiblin/Documents/bug-app/forge/.env.local", "utf8");
const SERVICE_KEY = envRaw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
const TRAVLI_TENANT_ID = "b71c57d9-23c7-4bfe-9db2-3d4ee7bd0b9b";
const WEB_PROJECT_ID   = "98603ead-676e-47fd-aded-92e9138fbe6b";

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

const pyTmp = join(tmpdir(), "forge_backfill.py");
writeFileSync(pyTmp, pyScript);
const rawRows = JSON.parse(execSync(`python3 ${pyTmp}`, { encoding: "utf8" }));
unlinkSync(pyTmp);

const uatRows = rawRows
  .map(r => ({ id: String(r[0] ?? "").trim(), category: String(r[1] ?? "").trim(), subCategory: String(r[2] ?? "").trim(), uatNotes: r[6] }))
  .filter(r => r.uatNotes != null && String(r.uatNotes).trim() !== "-" && String(r.uatNotes).trim() !== "");

console.log(`${uatRows.length} rows with UAT notes`);

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Fetch all WEB issues once
const { data: issues } = await sb.from("issues").select("id, title").eq("project_id", WEB_PROJECT_ID);
const issueByTitle = new Map(issues.map(i => [i.title, i.id]));

let ok = 0, fail = 0;
for (const row of uatRows) {
  const title = `[${row.id}] [${row.category}] [${row.subCategory}]`;
  const issueId = issueByTitle.get(title);
  if (!issueId) {
    console.error(`  NOT FOUND: ${title}`);
    fail++;
    continue;
  }
  const { error } = await sb.from("issue_comments").insert({
    tenant_id:    TRAVLI_TENANT_ID,
    issue_id:     issueId,
    author_id:    null,
    author_label: "UAT Testing Notes",
    body:         String(row.uatNotes).trim(),
  });
  if (error) {
    console.error(`  FAIL ${title}: ${error.message}`);
    fail++;
  } else {
    console.log(`  ✓ ${title}`);
    ok++;
  }
}

console.log(`\nDone. ${ok} UAT comments added, ${fail} failed.`);
