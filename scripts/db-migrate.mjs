#!/usr/bin/env node
/**
 * Migration runner for Forge.
 *
 * Commands:
 *   node scripts/db-migrate.mjs status    — show applied vs pending (default)
 *   node scripts/db-migrate.mjs migrate   — apply pending migrations
 *   node scripts/db-migrate.mjs verify    — exit 1 if any migration is pending (CI)
 *
 * Auto-apply requires SUPABASE_ACCESS_TOKEN in .env.local (generate at
 * https://app.supabase.com/account/tokens). Without it, migrate prints the
 * SQL to paste into the Supabase Dashboard SQL editor.
 *
 * Migration files live in supabase/migrations/ and must follow:
 *   NNNN_<slug>.sql  (e.g. 0001_init_multitenancy.sql)
 *
 * Tracking: each migration self-registers by including at its end:
 *   insert into public.schema_migrations (filename) values ('NNNN_slug.sql')
 *   on conflict do nothing;
 *
 * 0011_migration_tracking.sql creates the table and backfills 0001-0010.
 * Apply that one manually first if schema_migrations doesn't exist yet.
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* CI injects env vars directly */ }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // optional

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Extract project ref from URL (https://<ref>.supabase.co)
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const MIGRATIONS_DIR = join(root, "supabase", "migrations");
const FILE_RE = /^\d{4}_[a-z0-9_]+\.sql$/i;

function getMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => FILE_RE.test(f)).sort();
}

function checksum(content) {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h + content.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

async function getApplied() {
  const { data, error } = await sb
    .from("schema_migrations")
    .select("filename, applied_at, checksum, notes")
    .order("filename");
  if (error) throw new Error(`schema_migrations not readable: ${error.message}`);
  return new Map(data.map((r) => [r.filename, r]));
}

async function execSql(sql) {
  if (!ACCESS_TOKEN) throw new Error("no-token");
  if (!PROJECT_REF) throw new Error("Cannot parse project ref from NEXT_PUBLIC_SUPABASE_URL");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Management API ${res.status}: ${body}`);
  }
}

// ─── status ──────────────────────────────────────────────────────────────────

async function cmdStatus() {
  const files = getMigrationFiles();
  let applied;
  let trackingMissing = false;

  try {
    applied = await getApplied();
  } catch {
    applied = new Map();
    trackingMissing = true;
  }

  let pendingCount = 0;
  let driftCount   = 0;

  console.log("\nForge migration status\n");

  if (trackingMissing) {
    console.log("  ⚠  schema_migrations table not found.");
    console.log("     Apply 0011_migration_tracking.sql via the Supabase Dashboard first.\n");
  }

  for (const f of files) {
    const content = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    const cs = checksum(content);
    const row = applied.get(f);
    if (!row) {
      console.log(`  PENDING  ${f}`);
      pendingCount++;
    } else if (row.checksum && row.checksum !== cs && !row.notes?.includes("backfilled")) {
      console.log(`  DRIFT    ${f}  (file checksum changed after apply)`);
      driftCount++;
    } else {
      const when = row.notes?.includes("backfilled")
        ? "backfilled"
        : new Date(row.applied_at).toLocaleString();
      console.log(`  applied  ${f}  (${when})`);
    }
  }

  for (const [f] of applied) {
    if (!files.includes(f)) {
      console.log(`  ORPHAN   ${f}  (in DB but no matching file)`);
      driftCount++;
    }
  }

  console.log("");
  if (!trackingMissing && pendingCount === 0 && driftCount === 0) {
    console.log("  ✓ DB is in sync with migration files.\n");
  } else {
    if (pendingCount) console.log(`  ${pendingCount} pending migration(s).`);
    if (driftCount)   console.log(`  ${driftCount} drift/orphan warning(s).`);
    if (pendingCount || driftCount) console.log("  Run: npm run db:migrate\n");
  }

  return { pendingCount, driftCount, trackingMissing };
}

// ─── migrate ─────────────────────────────────────────────────────────────────

async function cmdMigrate() {
  const files = getMigrationFiles();
  let applied;
  let trackingMissing = false;

  try {
    applied = await getApplied();
  } catch {
    applied = new Map();
    trackingMissing = true;
  }

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0 && !trackingMissing) {
    console.log("\n  Nothing to migrate. DB is up to date.\n");
    return;
  }

  if (trackingMissing) {
    console.log("\n  schema_migrations table not found.");
    console.log("  Apply 0011_migration_tracking.sql first, then re-run.\n");
    // Fall through to show SQL if access token present
  }

  if (!ACCESS_TOKEN) {
    // No auto-apply — print SQL for manual paste
    console.log("\n  No SUPABASE_ACCESS_TOKEN set — showing SQL to paste manually.\n");
    console.log("  To enable auto-apply: add SUPABASE_ACCESS_TOKEN to .env.local");
    console.log("  Generate one at: https://app.supabase.com/account/tokens\n");
    console.log("  ─────────────────────────────────────────────────────────────\n");
    for (const f of pending) {
      console.log(`  -- ${f}\n`);
      console.log(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
      console.log("\n  ─────────────────────────────────────────────────────────────\n");
    }
    console.log(`  ${pending.length} migration(s) shown. Paste into Supabase Dashboard → SQL editor.\n`);
    return;
  }

  console.log(`\n  Auto-applying ${pending.length} migration(s) via Management API...\n`);
  for (const f of pending) {
    const content = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    process.stdout.write(`  ${f} ... `);
    try {
      await execSql(content);
      console.log("done");
    } catch (err) {
      if (err.message === "no-token") {
        // shouldn't reach here but guard anyway
        console.log("skipped (no token)");
        continue;
      }
      console.log("FAILED");
      console.error(`\n  Error: ${err.message}\n`);
      console.error("  Migration halted. Fix the error and re-run.\n");
      process.exit(1);
    }
  }
  console.log("\n  All migrations applied.\n");
}

// ─── verify (CI) ─────────────────────────────────────────────────────────────

async function cmdVerify() {
  const { pendingCount, driftCount, trackingMissing } = await cmdStatus();
  if (trackingMissing || pendingCount > 0 || driftCount > 0) {
    console.error("  CI FAIL: DB is not in sync with migration files.\n");
    process.exit(1);
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

const cmd = process.argv[2] ?? "status";
switch (cmd) {
  case "migrate": await cmdMigrate(); break;
  case "status":  await cmdStatus();  break;
  case "verify":  await cmdVerify();  break;
  default:
    console.error(`Unknown command: ${cmd}. Use: migrate | status | verify`);
    process.exit(1);
}
