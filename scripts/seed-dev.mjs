/**
 * Seed a persistent DEV workspace: tenant #1 (Travli) + a founder owner user.
 * Idempotent — safe to run repeatedly. DEV credentials only.
 *
 * Run:  node --env-file=.env.local scripts/seed-dev.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/seed-dev.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const DEV_EMAIL = "founder@forge.dev";
const DEV_PASSWORD = "ForgeDev!2026";
const TENANT = { name: "Travli", slug: "travli", plan: "pro" };

async function ensureTenant() {
  const { data: existing } = await admin.from("tenants").select("*").eq("slug", TENANT.slug).maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin.from("tenants").insert(TENANT).select().single();
  if (error) throw new Error(`tenant: ${error.message}`);
  return data;
}

async function ensureAuthUser() {
  // find by email across pages (dev scale is tiny)
  for (let page = 1; page <= 5; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const found = data?.users.find((u) => u.email === DEV_EMAIL);
    if (found) return found;
    if (!data || data.users.length < 1000) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`auth user: ${error.message}`);
  return data.user;
}

async function ensureAppUser(authId) {
  const { data: existing } = await admin.from("users").select("*").eq("auth_id", authId).maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin
    .from("users").insert({ auth_id: authId, email: DEV_EMAIL, name: "Founder" }).select().single();
  if (error) throw new Error(`app user: ${error.message}`);
  return data;
}

async function ensureMembership(tenantId, userId) {
  const { data: existing } = await admin
    .from("memberships").select("*").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
  if (existing) return existing;
  const { error } = await admin.from("memberships").insert({ tenant_id: tenantId, user_id: userId, role: "owner" });
  if (error) throw new Error(`membership: ${error.message}`);
}

async function ensureProject(tenantId) {
  const { data: existing } = await admin
    .from("projects").select("*").eq("tenant_id", tenantId).eq("key", "WEB").maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin
    .from("projects").insert({ tenant_id: tenantId, key: "WEB", name: "Travli Web" }).select().single();
  if (error) throw new Error(`project: ${error.message}`);
  return data;
}

(async () => {
  const tenant = await ensureTenant();
  const authUser = await ensureAuthUser();
  const appUser = await ensureAppUser(authUser.id);
  await ensureMembership(tenant.id, appUser.id);
  await ensureProject(tenant.id);
  // NOTE: no longer seeds dummy issues — Travli starts empty for real bugs.

  console.log("\n✅ Dev workspace ready");
  console.log(`   Tenant : ${tenant.name} (/${tenant.slug})  ${tenant.id}`);
  console.log(`   Login  : ${DEV_EMAIL}`);
  console.log(`   Password: ${DEV_PASSWORD}`);
  console.log("\n   Sign in at http://localhost:3100/login\n");
})().catch((e) => {
  console.error("\nSEED ERROR:", e.message);
  process.exit(1);
});
