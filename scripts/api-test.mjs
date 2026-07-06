/**
 * API security test (Sprint 3 gate). Exercises /api/v1/issues over HTTP and
 * proves: auth required, scopes enforced, input validated, and — critically —
 * one tenant's key cannot see or touch another tenant's data.
 *
 * Requires the dev server running on :3100.
 * Run:  node --env-file=.env.local scripts/api-test.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.FORGE_BASE_URL || "http://localhost:3100";
const API_KEY_HASH_SECRET = process.env.API_KEY_HASH_SECRET;
if (!URL || !SERVICE) { console.error("Missing env."); process.exit(1); }
if (!API_KEY_HASH_SECRET) { console.error("Missing API_KEY_HASH_SECRET — set it in .env.local"); process.exit(1); }

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const hashKey = (raw) => createHmac("sha256", API_KEY_HASH_SECRET).update(raw).digest("hex");
const stamp = Date.now();

let pass = 0, fail = 0;
const created = { tenants: [] };
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? "  — " + detail : ""}`); }
}

async function api(method, path, key, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function seedTenant(label, scopes) {
  const { data: tenant } = await admin
    .from("tenants").insert({ name: `ApiTest ${label}`, slug: `apitest-${label}-${stamp}` }).select().single();
  created.tenants.push(tenant.id);
  await admin.from("projects").insert({ tenant_id: tenant.id, key: "WEB", name: "Web" });
  const raw = `forge_${label}_${randomBytes(20).toString("hex")}`;
  const { data: keyRow } = await admin.from("api_keys")
    .insert({ tenant_id: tenant.id, name: `${label} key`, key_prefix: raw.slice(0, 16), key_hash: hashKey(raw), scopes })
    .select().single();
  return { tenant, raw, keyId: keyRow.id };
}

async function cleanup() {
  for (const id of created.tenants) await admin.from("tenants").delete().eq("id", id);
}

async function main() {
  console.log("\n=== Forge API security test ===\n");

  const A = await seedTenant("a", ["issues:read", "issues:write"]);
  const B = await seedTenant("b", ["issues:read", "issues:write"]);
  const RO = await seedTenant("ro", ["issues:read"]); // read-only key

  console.log("Auth:");
  check("no key → 401", (await api("POST", "/api/v1/issues", null, { title: "x" })).status === 401);
  check("garbage key → 401", (await api("GET", "/api/v1/issues", "forge_nope_123")).status === 401);

  console.log("\nScopes:");
  const roPost = await api("POST", "/api/v1/issues", RO.raw, { title: "should fail" });
  check("read-only key cannot POST → 403", roPost.status === 403, `got ${roPost.status}`);

  console.log("\nValidation:");
  check("missing title → 422", (await api("POST", "/api/v1/issues", A.raw, {})).status === 422);
  check("bad JSON-less title type → 422", (await api("POST", "/api/v1/issues", A.raw, { title: "" })).status === 422);

  console.log("\nCreate + read (tenant A):");
  const createA = await api("POST", "/api/v1/issues", A.raw, {
    title: "Crash on checkout", priority: "urgent", type: "bug", environment: "prod", appVersion: "1.4.2",
  });
  check("write key creates issue → 201", createA.status === 201, `got ${createA.status}`);
  check("response returns issue key (WEB-1)", createA.json?.data?.key === "WEB-1", JSON.stringify(createA.json));
  const listA = await api("GET", "/api/v1/issues", A.raw);
  check("A lists its own issue", listA.status === 200 && listA.json?.data?.length === 1);
  check("list returns pagination metadata", listA.json?.pagination?.total === 1 && typeof listA.json?.pagination?.limit === "number",
    JSON.stringify(listA.json?.pagination));
  const issueAId = createA.json?.data?.id;

  console.log("\nUpdate (PATCH) + single GET:");
  const getOne = await api("GET", `/api/v1/issues/${issueAId}`, A.raw);
  check("GET single returns the issue", getOne.status === 200 && getOne.json?.data?.id === issueAId, `got ${getOne.status}`);
  const patch = await api("PATCH", `/api/v1/issues/${issueAId}`, A.raw, { status: "in_progress" });
  check("PATCH updates status → 200", patch.status === 200 && patch.json?.data?.status === "in_progress", JSON.stringify(patch.json));
  check("empty PATCH body → 422", (await api("PATCH", `/api/v1/issues/${issueAId}`, A.raw, {})).status === 422);
  check("read-only key cannot PATCH → 403", (await api("PATCH", `/api/v1/issues/${issueAId}`, RO.raw, { status: "done" })).status === 403);
  check("tenant B cannot PATCH A's issue → 404", (await api("PATCH", `/api/v1/issues/${issueAId}`, B.raw, { status: "done" })).status === 404);
  check("tenant B cannot GET A's issue → 404", (await api("GET", `/api/v1/issues/${issueAId}`, B.raw)).status === 404);

  console.log("\nConfig validation (per-tenant options):");
  check("POST unknown priority → 422", (await api("POST", "/api/v1/issues", A.raw, { title: "x", priority: "sky-high" })).status === 422);
  check("PATCH unknown status → 422", (await api("PATCH", `/api/v1/issues/${issueAId}`, A.raw, { status: "nope" })).status === 422);

  console.log("\nIdempotency (safe retries for an outbox worker):");
  const idem = `outbox-${stamp}-xyz`;
  const first = await api("POST", "/api/v1/issues", A.raw, { title: "Idempotent report" }, { "Idempotency-Key": idem });
  const second = await api("POST", "/api/v1/issues", A.raw, { title: "Idempotent report" }, { "Idempotency-Key": idem });
  check("first send creates → 201", first.status === 201, `got ${first.status}`);
  check("retry with same key returns same issue → 200", second.status === 200 && second.json?.data?.key === first.json?.data?.key,
    `status ${second.status}, key ${second.json?.data?.key} vs ${first.json?.data?.key}`);
  const listAfter = await api("GET", "/api/v1/issues", A.raw);
  check("retry did NOT create a duplicate", listAfter.json?.data?.length === 2, `count ${listAfter.json?.data?.length}`);

  console.log("\nISOLATION (the critical part):");
  const listB = await api("GET", "/api/v1/issues", B.raw);
  check("tenant B's key sees NONE of A's issues", listB.status === 200 && (listB.json?.data?.length ?? -1) === 0,
    `B saw ${listB.json?.data?.length}`);
  const createB = await api("POST", "/api/v1/issues", B.raw, { title: "B's own issue" });
  check("B creates only in its own tenant (WEB-1, not 2)", createB.json?.data?.key === "WEB-1",
    JSON.stringify(createB.json));

  console.log("\nRevocation:");
  await admin.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", A.keyId);
  check("revoked key → 401", (await api("GET", "/api/v1/issues", A.raw)).status === 401);

  console.log(`\n=== ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed ===\n`);
}

main()
  .catch((e) => { console.error("\nERROR:", e.message); fail++; })
  .finally(async () => { await cleanup().catch(() => {}); process.exit(fail === 0 ? 0 : 1); });
