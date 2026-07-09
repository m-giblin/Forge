#!/usr/bin/env node
/**
 * RBAC audit — the safety net for the exact bug class found in the 2026-07-08
 * RBAC session: a server action or API route that writes to the database
 * with NO permission check anywhere in the file at all (not "wrong check",
 * "no check"). That bug is silent — nothing crashes, nothing errors, a
 * feature just quietly has no access control. This script turns it into a
 * CI failure instead of something an audit finds months later.
 *
 * HONEST LIMITATION: this is a file-level heuristic, not a proof of
 * correctness. It flags "this file writes to the DB and contains no
 * recognizable guard pattern anywhere in it." It cannot verify the guard is
 * on the right code path, applied to the right permission, or bug-free — a
 * human still has to look at anything it flags. It exists to catch the
 * *absence* of any attempt, not to grade the quality of an attempt.
 *
 * Usage: node scripts/audit-rbac.mjs   (wired into `npm run check`)
 * To intentionally exempt a file (e.g. it's genuinely public, or gated a
 * different way this script doesn't recognize), add its path to ALLOWLIST
 * below with a one-line reason — same discipline as an eslint-disable.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SCAN_DIRS = [join(ROOT, "src/app")];

const MUTATION_PATTERNS = [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/];

// A mutation through the regular (user-JWT) Supabase client is already gated
// by Postgres RLS regardless of app-code checks — that's the whole point of
// RLS. The dangerous combination this script exists to catch is specifically
// service-role (RLS-bypassing) + no app-level check at all. Files that only
// ever mutate via the regular client are skipped entirely.
const SERVICE_ROLE_PATTERN = /createSupabaseServiceClient/;

// Any of these anywhere in the file counts as "made some attempt to gate access."
const GUARD_PATTERNS = [
  /ctxCanDo\(/, /rbacCanDo\(/, /\bcanDo\(/,
  /assertAdmin\(/, /assertOwnerOrAdmin\(/, /assertCanManageProjects\(/, /requireAdmin\(/,
  /requireSuperAdmin\(/, /requireSuperAdmin\b/,
  /ctx\.role\s*(===|!==)/, /role\s*(===|!==)\s*["']/, /membership\.role\s*(===|!==)/,
  /\.includes\(\s*(ctx\.)?role\s*\)/,      // if (!["owner","admin"].includes(ctx.role))
  /\.in\(\s*["']role["']\s*,/,             // .in("role", ["owner","admin"])
  /\benforce\(/,           // /api/v1 API-key gate
  /authenticateScim\(/,     // SCIM bearer-token gate
  /constructEvent\(/,       // Stripe/webhook signature verification
  /parseBearer\(/,
  /getRateLimiter\(/,       // rate-limited public endpoints (login, sso-check) are a deliberate exception, not unguarded
  // Self-scoped writes (a user editing their own availability/notifications/
  // settings) are an identity check, not a role permission — also legitimate.
  /ctx\.appUserId/,
];

// Files that are legitimately exempt, with a reason — same discipline as an
// eslint-disable comment. Path is relative to src/app.
const ALLOWLIST = new Map([
  ["api/signup/route.ts", "public signup — no tenant/session to gate yet"],
  ["api/auth/login/route.ts", "public login endpoint — rate-limited, no session yet"],
  ["api/auth/sso-check/route.ts", "public pre-auth domain lookup — rate-limited, returns only a boolean"],
  ["api/webhooks/stripe/route.ts", "gated by Stripe signature verification (constructEvent), matched separately"],
  ["api/spaces/guest/verify/session/route.ts", "regex false-positive: only match is createHash(...).update(), Node crypto not a Supabase mutation — this route only SELECTs"],
  ["auth/callback/route.ts", "the .insert() creates the users row for a brand-new OAuth/SSO signee — no tenant identity exists yet to check a permission against, same category as signup"],
]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full));
    } else if (/^(actions|route)\.tsx?$/.test(entry) || /Actions\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = SCAN_DIRS.flatMap(walk);
  const flagged = [];

  for (const file of files) {
    const relPath = relative(join(ROOT, "src/app"), file);
    if (ALLOWLIST.has(relPath)) continue;

    const content = readFileSync(file, "utf8");
    const hasMutation = MUTATION_PATTERNS.some((p) => p.test(content));
    if (!hasMutation) continue;

    // Regular-client mutations are already gated by Postgres RLS — only a
    // service-role (RLS-bypassing) write with no app-level check is the real risk.
    const usesServiceRole = SERVICE_ROLE_PATTERN.test(content);
    if (!usesServiceRole) continue;

    const hasGuard = GUARD_PATTERNS.some((p) => p.test(content));
    if (!hasGuard) flagged.push(relPath);
  }

  if (flagged.length > 0) {
    console.error(`\n✖ RBAC audit: ${flagged.length} file(s) mutate via the service-role client (bypasses RLS) with no recognizable permission or self-scope check:\n`);
    for (const f of flagged) console.error(`  - src/app/${f}`);
    console.error(
      `\nEither add a check (ctxCanDo/rbacCanDo/canDo/requireSuperAdmin/role check/enforce/etc.), or if this file` +
      `\nis genuinely exempt, add it to ALLOWLIST in scripts/audit-rbac.mjs with a one-line reason.\n`
    );
    process.exit(1);
  }

  console.log(`✓ RBAC audit: ${files.length} action/route files scanned, no unguarded service-role writes found.`);
}

main();
