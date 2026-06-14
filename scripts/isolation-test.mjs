/**
 * Tenant isolation test (Sprint 1 gate).
 *
 * Proves the core multi-tenant guarantee: a signed-in user of tenant A cannot
 * read or write tenant B's data. Exercises both access paths:
 *   - service_role (provisioning) seeds two tenants + users + projects
 *   - each real user signs in and is checked against RLS
 *
 * Run:  node --env-file=.env.local scripts/isolation-test.mjs
 * The AI never touches the DB — you run this; the keys come from .env.local.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error("Missing env. Run with: node --env-file=.env.local scripts/isolation-test.mjs");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const stamp = Date.now();
const PW = "Test-" + stamp + "-pw!";
let pass = 0, fail = 0;
const created = { tenants: [], users: [], authUsers: [] };

function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? "  — " + detail : ""}`); }
}

// Sign a user in and return a client whose requests carry that user's JWT.
async function clientAsUser(email) {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PW });
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function seedTenant(label) {
  const email = `iso-${label}-${stamp}@example.com`;

  const { data: tenant, error: tErr } = await admin
    .from("tenants").insert({ name: `Iso ${label}`, slug: `iso-${label}-${stamp}` })
    .select().single();
  if (tErr) throw new Error(`tenant insert (${label}): ${tErr.message}`);
  created.tenants.push(tenant.id);

  const { data: authUser, error: aErr } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true,
  });
  if (aErr) throw new Error(`auth user (${label}): ${aErr.message}`);
  created.authUsers.push(authUser.user.id);

  const { data: appUser, error: uErr } = await admin
    .from("users").insert({ auth_id: authUser.user.id, email, name: `Iso ${label}` })
    .select().single();
  if (uErr) throw new Error(`user insert (${label}): ${uErr.message}`);
  created.users.push(appUser.id);

  const { error: mErr } = await admin
    .from("memberships").insert({ tenant_id: tenant.id, user_id: appUser.id, role: "owner" });
  if (mErr) throw new Error(`membership (${label}): ${mErr.message}`);

  const { data: project, error: pErr } = await admin
    .from("projects").insert({ tenant_id: tenant.id, key: "WEB", name: `Project ${label}` })
    .select().single();
  if (pErr) throw new Error(`project insert (${label}): ${pErr.message}`);

  return { tenant, email, project };
}

async function cleanup() {
  // tenants cascade -> memberships + projects. users + auth users explicit.
  for (const id of created.tenants) await admin.from("tenants").delete().eq("id", id);
  for (const id of created.users) await admin.from("users").delete().eq("id", id);
  for (const id of created.authUsers) await admin.auth.admin.deleteUser(id);
}

async function main() {
  console.log("\n=== Forge tenant isolation test ===\n");

  console.log("Seeding two tenants via service_role (provisioning path)…");
  const A = await seedTenant("A");
  const B = await seedTenant("B");
  console.log(`  seeded tenant A=${A.tenant.id}  B=${B.tenant.id}\n`);

  const asA = await clientAsUser(A.email);
  const asB = await clientAsUser(B.email);

  console.log("Human path — user A (RLS via JWT):");
  {
    const { data: tenants } = await asA.from("tenants").select("id");
    check("sees exactly 1 tenant (own)", tenants?.length === 1 && tenants[0].id === A.tenant.id,
      `saw ${tenants?.length ?? 0}`);

    const { data: projects } = await asA.from("projects").select("id, tenant_id");
    check("sees only own project", projects?.length === 1 && projects[0].tenant_id === A.tenant.id,
      `saw ${projects?.length ?? 0}`);

    const { data: bProject } = await asA.from("projects").select("id").eq("id", B.project.id);
    check("cannot read tenant B's project by id", (bProject?.length ?? 0) === 0,
      `leaked ${bProject?.length ?? 0} row(s)`);

    const { data: bTenant } = await asA.from("tenants").select("id").eq("id", B.tenant.id);
    check("cannot read tenant B's tenant row", (bTenant?.length ?? 0) === 0);

    const { error: wErr } = await asA.from("projects")
      .insert({ tenant_id: B.tenant.id, key: "HACK", name: "intrusion" });
    check("cannot write into tenant B (RLS blocks insert)", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nHuman path — user B (RLS via JWT):");
  {
    const { data: projects } = await asB.from("projects").select("id, tenant_id");
    check("sees only own project", projects?.length === 1 && projects[0].tenant_id === B.tenant.id,
      `saw ${projects?.length ?? 0}`);
  }

  console.log(`\n=== ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed ===\n`);
}

main()
  .catch((e) => { console.error("\nERROR:", e.message); fail++; })
  .finally(async () => {
    await cleanup().catch((e) => console.error("cleanup warning:", e.message));
    process.exit(fail === 0 ? 0 : 1);
  });
