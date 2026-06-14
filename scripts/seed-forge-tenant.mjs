/**
 * Dogfood setup: an internal "Forge" tenant whose issues ARE our sprint backlog.
 * Idempotent. Prints an API key (once) for driving the board over the API.
 *
 * Run:  node --env-file=.env.local scripts/seed-forge-tenant.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) { console.error("Missing env."); process.exit(1); }
const a = createClient(URL, SERVICE, { auth: { persistSession: false } });
const hashKey = (raw) => createHash("sha256").update(raw).digest("hex");

const OWNER_EMAIL = "founder@forge.dev";
const BACKLOG = [
  ["Phase 1 Step B — wire board/list/create/API to tenant config", "feature", "high", "in_progress"],
  ["PATCH /api/v1/issues/{id} endpoint", "task", "high", "done"],
  ["Phase 2 — generic custom fields (JSONB + admin UI)", "feature", "medium", "backlog"],
  ["Phase 3 — Travli QA spreadsheet import tool", "feature", "medium", "backlog"],
  ["Board pagination (currently loads all issues)", "task", "medium", "backlog"],
  ["Soft caps: ~15 statuses, ~50 custom fields", "task", "low", "backlog"],
  ["Swap in-memory rate limiter → Redis/Upstash for prod", "task", "medium", "backlog"],
  ["Dedicated test Supabase project for CI integration job", "task", "low", "backlog"],
  ["Fix: suspend audit target uses tenant id not slug", "bug", "low", "backlog"],
];

async function ensureTenant() {
  const { data: ex } = await a.from("tenants").select("*").eq("slug", "forge").maybeSingle();
  if (ex) return ex;
  const { data, error } = await a.from("tenants").insert({ name: "Forge", slug: "forge", plan: "internal" }).select().single();
  if (error) throw new Error(`tenant: ${error.message}`);
  return data; // trigger auto-seeds field options
}
async function ownerUserId() {
  const { data } = await a.from("users").select("id").eq("email", OWNER_EMAIL).maybeSingle();
  if (!data) throw new Error(`No user ${OWNER_EMAIL}; run seed:dev first.`);
  return data.id;
}
async function ensureProject(tenantId) {
  const { data: ex } = await a.from("projects").select("*").eq("tenant_id", tenantId).eq("key", "FORGE").maybeSingle();
  if (ex) return ex;
  const { data, error } = await a.from("projects").insert({ tenant_id: tenantId, key: "FORGE", name: "Forge Platform" }).select().single();
  if (error) throw new Error(`project: ${error.message}`);
  return data;
}

(async () => {
  const tenant = await ensureTenant();
  const uid = await ownerUserId();
  await a.from("memberships").upsert({ tenant_id: tenant.id, user_id: uid, role: "owner" }, { onConflict: "tenant_id,user_id", ignoreDuplicates: true });
  const project = await ensureProject(tenant.id);

  // Seed backlog only if empty.
  const { data: existing } = await a.from("issues").select("id").eq("tenant_id", tenant.id).limit(1);
  if (!existing || existing.length === 0) {
    const rows = BACKLOG.map(([title, type, priority, status]) => ({
      tenant_id: tenant.id, project_id: project.id, title, type, priority, status, source: "web", reporter_id: uid,
    }));
    const { error } = await a.from("issues").insert(rows);
    if (error) throw new Error(`issues: ${error.message}`);
    console.log(`Seeded ${rows.length} backlog issues.`);
  } else {
    console.log("Backlog already seeded; skipping issues.");
  }

  // Mint a dogfood API key (always issue a fresh one when run).
  const raw = `forge_forge_${randomBytes(24).toString("hex")}`;
  await a.from("api_keys").insert({
    tenant_id: tenant.id, name: "Dogfood key", key_prefix: raw.slice(0, 20), key_hash: hashKey(raw),
    scopes: ["issues:read", "issues:write"], created_by: uid,
  });

  console.log(`\n✅ Forge internal tenant ready (/forge), owner ${OWNER_EMAIL}`);
  console.log(`   Board: http://localhost:3100/forge/board`);
  console.log(`   Dogfood API key (store it): ${raw}\n`);
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
