/**
 * Tenant isolation test (Sprint 1 gate + Think Tank Phase 1 + SEC-25 extension).
 *
 * Proves the core multi-tenant guarantee: a signed-in user of tenant A cannot
 * read or write tenant B's data. Exercises both access paths:
 *   - service_role (provisioning) seeds two tenants + users + projects + all tables
 *   - each real user signs in and is checked against RLS
 *
 * Tables covered (as of 2026-06-18, migrations 0001-0032):
 *   tenants, memberships, projects, ideas, think_tanks, idea_comments,
 *   idea_ai_turns, idea_votes, idea_decisions, project_wiki_pages,
 *   git_connections, git_repo_links, code_events, idea_signoffs,
 *   project_spend, issues, issue_code_links,
 *   feature_flags (service-role only — no user SELECT policy),
 *   tenant_feature_overrides (service-role only)
 *
 * Also tests intra-tenant private idea visibility (ideas_select is_private policy).
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
let pass = 0, fail = 0, skipped = 0;
const created = { tenants: [], users: [], authUsers: [] };

// Probe which tables exist (PostgREST schema cache). Returns a Set of table names.
async function availableTables(names) {
  const present = new Set();
  await Promise.all(names.map(async (t) => {
    const { error } = await admin.from(t).select("id").limit(0);
    if (!error) present.add(t);
    else if (!error.message?.includes("schema cache")) present.add(t); // other errors = table exists
  }));
  return present;
}

function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? "  — " + detail : ""}`); }
}
function skip(name, reason) {
  skipped++;
  console.log(`  ⚠️  SKIP ${name} — ${reason}`);
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

// Tables that were present at Sprint 1 isolation gate — always expected.
const CORE_TABLES = new Set([
  "tenants", "memberships", "projects", "ideas", "think_tanks",
  "idea_comments", "idea_ai_turns",
]);

async function seedTenant(label, tables) {
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

  // Think Tank + ideas
  const { data: thinkTank, error: ttErr } = await admin
    .from("think_tanks").insert({ tenant_id: tenant.id, name: `TT ${label}`, created_by: appUser.id })
    .select().single();
  if (ttErr) throw new Error(`think_tank insert (${label}): ${ttErr.message}`);

  const { data: publicIdea, error: piErr } = await admin
    .from("ideas").insert({ tenant_id: tenant.id, think_tank_id: thinkTank.id, title: `Public Idea ${label}`, created_by: appUser.id, is_private: false })
    .select().single();
  if (piErr) throw new Error(`public idea insert (${label}): ${piErr.message}`);

  const { data: privateIdea, error: priErr } = await admin
    .from("ideas").insert({ tenant_id: tenant.id, think_tank_id: thinkTank.id, title: `Private Idea ${label}`, created_by: appUser.id, is_private: true })
    .select().single();
  if (priErr) throw new Error(`private idea insert (${label}): ${priErr.message}`);

  const { data: comment, error: cErr } = await admin
    .from("idea_comments").insert({ tenant_id: tenant.id, idea_id: publicIdea.id, author_id: appUser.id, body: `Comment ${label}` })
    .select().single();
  if (cErr) throw new Error(`idea_comment insert (${label}): ${cErr.message}`);

  const { error: aiErr } = await admin
    .from("idea_ai_turns").insert({ tenant_id: tenant.id, idea_id: publicIdea.id, user_id: appUser.id, pills: [], ai_response: "test" });
  if (aiErr) throw new Error(`idea_ai_turn insert (${label}): ${aiErr.message}`);

  // idea_votes (0017)
  if (tables.has("idea_votes")) {
    const { error: vErr } = await admin
      .from("idea_votes").insert({ tenant_id: tenant.id, idea_id: publicIdea.id, user_id: appUser.id });
    if (vErr) throw new Error(`idea_votes insert (${label}): ${vErr.message}`);
  }

  // idea_decisions (0025)
  let decision = null;
  if (tables.has("idea_decisions")) {
    const { data, error: dErr } = await admin
      .from("idea_decisions").insert({ tenant_id: tenant.id, idea_id: publicIdea.id, title: `Decision ${label}`, decided_by: appUser.id })
      .select().single();
    if (dErr) throw new Error(`idea_decisions insert (${label}): ${dErr.message}`);
    decision = data;
  }

  // project_wiki_pages (0027)
  let wikiPage = null;
  if (tables.has("project_wiki_pages")) {
    const { data, error: wErr } = await admin
      .from("project_wiki_pages").insert({ tenant_id: tenant.id, project_id: project.id, title: "Overview", body: `Wiki ${label}`, created_by: appUser.id })
      .select().single();
    if (wErr) throw new Error(`project_wiki_pages insert (${label}): ${wErr.message}`);
    wikiPage = data;
  }

  // git tables (0028) — skip if migration not applied
  let gitConn = null, repoLink = null, codeEvent = null, issue = null, codeLink = null;
  if (tables.has("git_connections")) {
    const { data, error: gcErr } = await admin
      .from("git_connections").insert({
        tenant_id: tenant.id,
        provider: "github",
        installation_id: `install-${label}-${stamp}`,
        account_login: `org-${label}`,
        status: "active",
        created_by: appUser.id,
      })
      .select().single();
    if (gcErr) throw new Error(`git_connections insert (${label}): ${gcErr.message}`);
    gitConn = data;

    const { data: rl, error: rlErr } = await admin
      .from("git_repo_links").insert({
        tenant_id: tenant.id,
        connection_id: gitConn.id,
        repo_full_name: `org-${label}/web`,
        project_id: project.id,
      })
      .select().single();
    if (rlErr) throw new Error(`git_repo_links insert (${label}): ${rlErr.message}`);
    repoLink = rl;

    const { data: ce, error: ceErr } = await admin
      .from("code_events").insert({
        tenant_id: tenant.id,
        connection_id: gitConn.id,
        repo_full_name: `org-${label}/web`,
        kind: "commit",
        external_id: `sha-${label}-${stamp}`,
        sha: `abc${stamp}`,
        actor_login: `dev-${label}`,
        occurred_at: new Date().toISOString(),
        payload: {},
      })
      .select().single();
    if (ceErr) throw new Error(`code_events insert (${label}): ${ceErr.message}`);
    codeEvent = ce;

    // issues needed for issue_code_links (number auto-set by trigger)
    const { data: iss, error: issErr } = await admin
      .from("issues").insert({ tenant_id: tenant.id, project_id: project.id, number: 1, title: `Issue ${label}` })
      .select().single();
    if (issErr) throw new Error(`issues insert (${label}): ${issErr.message}`);
    issue = iss;

    const { data: cl, error: clErr } = await admin
      .from("issue_code_links").insert({
        tenant_id: tenant.id,
        issue_id: issue.id,
        connection_id: gitConn.id,
        repo_full_name: `org-${label}/web`,
        pr_number: 1,
        link_kind: "ref",
        pr_state: "open",
        pr_title: `PR for ${label}`,
      })
      .select().single();
    if (clErr) throw new Error(`issue_code_links insert (${label}): ${clErr.message}`);
    codeLink = cl;
  }

  // idea_signoffs (0029)
  let signoff = null;
  if (tables.has("idea_signoffs")) {
    const { data, error: soErr } = await admin
      .from("idea_signoffs").insert({ tenant_id: tenant.id, idea_id: publicIdea.id, role: "design", approved_by: appUser.id })
      .select().single();
    if (soErr) throw new Error(`idea_signoffs insert (${label}): ${soErr.message}`);
    signoff = data;
  }

  // project_spend (0031)
  let spend = null;
  if (tables.has("project_spend")) {
    const { data, error: spErr } = await admin
      .from("project_spend").insert({
        tenant_id: tenant.id,
        project_id: project.id,
        item: `Spend ${label}`,
        amount_cents: 10000,
        spent_on: new Date().toISOString().split("T")[0],
        created_by: appUser.id,
      })
      .select().single();
    if (spErr) throw new Error(`project_spend insert (${label}): ${spErr.message}`);
    spend = data;
  }

  return {
    tenant, email, project, thinkTank, publicIdea, privateIdea, comment, appUser,
    gitConn, repoLink, codeEvent, signoff, spend, issue, codeLink, wikiPage, decision,
  };
}

async function seedMember(tenantId, label) {
  const email = `iso-${label}-${stamp}@example.com`;
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
    .from("memberships").insert({ tenant_id: tenantId, user_id: appUser.id, role: "member" });
  if (mErr) throw new Error(`membership (${label}): ${mErr.message}`);

  return { email, appUser };
}

async function cleanup() {
  // tenants cascade → memberships, projects, think_tanks, ideas, idea_comments,
  // idea_ai_turns, idea_votes, idea_decisions, project_wiki_pages, git_connections
  // (→ git_repo_links, code_events, issue_code_links), idea_signoffs,
  // project_spend, issues, issue_code_links
  for (const id of created.tenants) await admin.from("tenants").delete().eq("id", id);
  for (const id of created.users) await admin.from("users").delete().eq("id", id);
  for (const id of created.authUsers) await admin.auth.admin.deleteUser(id);
}

async function main() {
  console.log("\n=== Forge tenant isolation test ===\n");

  // Probe schema availability so we can run conditional tests on partly-applied migrations.
  const ALL_TABLES = [
    "tenants", "memberships", "projects", "ideas", "think_tanks",
    "idea_comments", "idea_ai_turns",
    // SEC-25 additions:
    "idea_votes", "idea_decisions", "project_wiki_pages",
    "git_connections", "git_repo_links", "code_events", "issue_code_links",
    "idea_signoffs", "project_spend",
    "feature_flags", "tenant_feature_overrides",
  ];
  const tables = await availableTables(ALL_TABLES);
  const missing = ALL_TABLES.filter((t) => !tables.has(t));
  if (missing.length) {
    console.log(`  ⚠️  Missing tables (run pending migrations): ${missing.join(", ")}\n`);
  } else {
    console.log("  ✅ All expected tables present in schema cache\n");
  }

  console.log("Seeding two tenants via service_role (provisioning path)…");
  const A = await seedTenant("A", tables);
  const B = await seedTenant("B", tables);
  // Second member in tenant A (member role, not owner) for private-idea test
  const A2 = await seedMember(A.tenant.id, "A2");
  console.log(`  seeded tenant A=${A.tenant.id}  B=${B.tenant.id}  member A2 in tenant A\n`);

  const asA = await clientAsUser(A.email);
  const asB = await clientAsUser(B.email);
  const asA2 = await clientAsUser(A2.email);

  // ─── Original checks ──────────────────────────────────────────────────────

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

  console.log("\nThink Tank isolation — cross-tenant (user A vs tenant B):");
  {
    const { data: tt } = await asA.from("think_tanks").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's think_tanks", (tt?.length ?? 0) === 0,
      `leaked ${tt?.length ?? 0} row(s)`);

    const { data: ideas } = await asA.from("ideas").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's ideas", (ideas?.length ?? 0) === 0,
      `leaked ${ideas?.length ?? 0} row(s)`);

    const { error: ideaWErr } = await asA.from("ideas").insert({
      tenant_id: B.tenant.id, think_tank_id: B.thinkTank.id,
      title: "intrusion idea", created_by: A.appUser.id,
    });
    check("cannot write idea into tenant B", !!ideaWErr,
      ideaWErr ? "" : "INSERT SUCCEEDED — isolation breach");

    const { data: comments } = await asA.from("idea_comments").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's idea_comments", (comments?.length ?? 0) === 0,
      `leaked ${comments?.length ?? 0} row(s)`);

    const { data: aiTurns } = await asA.from("idea_ai_turns").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's idea_ai_turns", (aiTurns?.length ?? 0) === 0,
      `leaked ${aiTurns?.length ?? 0} row(s)`);
  }

  console.log("\nThink Tank — private idea visibility (intra-tenant):");
  {
    const { data: seen } = await asA2.from("ideas").select("id").eq("id", A.privateIdea.id);
    check("member A2 cannot see owner A's private idea", (seen?.length ?? 0) === 0,
      `leaked ${seen?.length ?? 0} row(s)`);

    const { data: own } = await asA.from("ideas").select("id").eq("id", A.privateIdea.id);
    check("owner A can see own private idea", (own?.length ?? 0) === 1,
      `saw ${own?.length ?? 0} row(s)`);
  }

  // ─── SEC-25: New tables added since 2026-06-15 ────────────────────────────

  const needsMigration = (name) => `migration for ${name} not yet applied`;

  console.log("\nSEC-25 — idea_votes (0017):");
  if (!tables.has("idea_votes")) { skip("idea_votes checks", needsMigration("0017")); }
  else {
    const { data: rows } = await asA.from("idea_votes").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's idea_votes", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    // user_id must equal auth.uid() per RLS policy, so this also fails on tenant check
    const { error: wErr } = await asA.from("idea_votes")
      .insert({ tenant_id: B.tenant.id, idea_id: B.publicIdea.id, user_id: A.appUser.id });
    check("cannot vote in tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — idea_decisions (0025):");
  if (!tables.has("idea_decisions")) { skip("idea_decisions checks", needsMigration("0025")); }
  else {
    const { data: rows } = await asA.from("idea_decisions").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's idea_decisions", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("idea_decisions")
      .insert({ tenant_id: B.tenant.id, idea_id: B.publicIdea.id, title: "intrusion decision" });
    check("cannot insert decision into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — project_wiki_pages (0027):");
  if (!tables.has("project_wiki_pages")) { skip("project_wiki_pages checks", needsMigration("0027")); }
  else {
    const { data: rows } = await asA.from("project_wiki_pages").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's project_wiki_pages", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("project_wiki_pages")
      .insert({ tenant_id: B.tenant.id, project_id: B.project.id, title: "intrusion wiki", body: "x", created_by: A.appUser.id });
    check("cannot insert wiki page into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — git_connections (0028):");
  if (!tables.has("git_connections")) { skip("git_connections checks", needsMigration("0028")); }
  else {
    const { data: rows } = await asA.from("git_connections").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's git_connections", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("git_connections")
      .insert({ tenant_id: B.tenant.id, provider: "github", installation_id: `intrusion-${stamp}`, status: "active" });
    check("cannot insert git_connection into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — git_repo_links (0028):");
  if (!tables.has("git_repo_links") || !B.gitConn) { skip("git_repo_links checks", needsMigration("0028")); }
  else {
    const { data: rows } = await asA.from("git_repo_links").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's git_repo_links", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("git_repo_links")
      .insert({ tenant_id: B.tenant.id, connection_id: B.gitConn.id, repo_full_name: "intrusion/repo" });
    check("cannot insert git_repo_link into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — code_events (0028):");
  if (!tables.has("code_events") || !B.gitConn) { skip("code_events checks", needsMigration("0028")); }
  else {
    const { data: rows } = await asA.from("code_events").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's code_events", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("code_events").insert({
      tenant_id: B.tenant.id,
      connection_id: B.gitConn.id,
      repo_full_name: "intrusion/repo",
      kind: "commit",
      external_id: `intrusion-${stamp}`,
      occurred_at: new Date().toISOString(),
      payload: {},
    });
    check("cannot insert code_event into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — issue_code_links (0028):");
  if (!tables.has("issue_code_links") || !B.gitConn || !B.issue) { skip("issue_code_links checks", needsMigration("0028")); }
  else {
    const { data: rows } = await asA.from("issue_code_links").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's issue_code_links", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("issue_code_links").insert({
      tenant_id: B.tenant.id,
      issue_id: B.issue.id,
      connection_id: B.gitConn.id,
      repo_full_name: "intrusion/repo",
      pr_number: 99,
      link_kind: "ref",
    });
    check("cannot insert issue_code_link into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — idea_signoffs (0029):");
  if (!tables.has("idea_signoffs")) { skip("idea_signoffs checks", needsMigration("0029")); }
  else {
    const { data: rows } = await asA.from("idea_signoffs").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's idea_signoffs", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("idea_signoffs")
      .insert({ tenant_id: B.tenant.id, idea_id: B.publicIdea.id, role: "engineering", approved_by: A.appUser.id });
    check("cannot insert signoff into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — project_spend (0031):");
  if (!tables.has("project_spend")) { skip("project_spend checks", needsMigration("0031")); }
  else {
    const { data: rows } = await asA.from("project_spend").select("id").eq("tenant_id", B.tenant.id);
    check("cannot read B's project_spend", (rows?.length ?? 0) === 0,
      `leaked ${rows?.length ?? 0} row(s)`);
    const { error: wErr } = await asA.from("project_spend")
      .insert({ tenant_id: B.tenant.id, project_id: B.project.id, item: "intrusion", amount_cents: 1, spent_on: "2026-01-01" });
    check("cannot insert spend into tenant B", !!wErr,
      wErr ? "" : "INSERT SUCCEEDED — isolation breach");
  }

  console.log("\nSEC-25 — feature_flags + tenant_feature_overrides (0032, service-role only):");
  if (!tables.has("feature_flags")) { skip("feature_flags checks", needsMigration("0032")); }
  else {
    // No SELECT policy — RLS enabled but empty → user sees 0 rows (correct behaviour).
    const { data: flags } = await asA.from("feature_flags").select("key");
    check("feature_flags returns 0 rows for user JWT (service-role only)", (flags?.length ?? 0) === 0,
      `saw ${flags?.length ?? 0} row(s)`);
  }
  if (!tables.has("tenant_feature_overrides")) { skip("tenant_feature_overrides checks", needsMigration("0032")); }
  else {
    const { data: overrides } = await asA.from("tenant_feature_overrides").select("key");
    check("tenant_feature_overrides returns 0 rows for user JWT (service-role only)", (overrides?.length ?? 0) === 0,
      `saw ${overrides?.length ?? 0} row(s)`);
  }

  const summary = skipped > 0
    ? `${pass} passed, ${fail} failed, ${skipped} skipped (pending migrations)`
    : `${pass} passed, ${fail} failed`;
  console.log(`\n=== ${fail === 0 ? "PASS" : "FAIL"} — ${summary} ===\n`);
}

main()
  .catch((e) => { console.error("\nERROR:", e.message); fail++; })
  .finally(async () => {
    await cleanup().catch((e) => console.error("cleanup warning:", e.message));
    process.exit(fail === 0 ? 0 : 1);
  });
