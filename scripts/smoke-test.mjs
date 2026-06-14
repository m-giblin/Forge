/**
 * Board data smoke test (closes the review #7 coverage gap).
 *
 * Signs in as the dev founder and runs the SAME queries the board/list pages
 * load (the human path, through RLS). This is the path that broke when the
 * tenant_custom_fields table was missing (PGRST205) yet passed every other
 * gate — none of them exercise loadBoard. This does.
 *
 * Run:  node --env-file=.env.local scripts/smoke-test.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) { console.error("Missing env."); process.exit(1); }

const EMAIL = "founder@forge.dev";
const PASSWORD = "ForgeDev!2026";
const SLUG = "forge";

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? "  — " + detail : ""}`); }
}

async function main() {
  console.log("\n=== Board data smoke test (human path / RLS) ===\n");

  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signin, error: signErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (signErr || !signin.session) throw new Error(`sign-in failed: ${signErr?.message}`);
  const sb = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${signin.session.access_token}` } },
  });

  // getSessionContext path: app user + memberships scoped to this user.
  const { data: appUser } = await sb.from("users").select("id").eq("auth_id", signin.user.id).maybeSingle();
  check("resolves app user", !!appUser);
  const { data: memberships, error: mErr } = await sb
    .from("memberships").select("role, tenant:tenants(id, name, slug)").eq("user_id", appUser.id);
  check("loads own memberships (no error)", !mErr && (memberships?.length ?? 0) >= 1, mErr?.message);

  // getTenantContext path: tenant by slug (RLS only returns it if a member).
  const { data: tenant } = await sb.from("tenants").select("id, name, slug").eq("slug", SLUG).maybeSingle();
  check("sees the Forge tenant (member)", !!tenant);
  if (!tenant) { return; }

  // loadBoard's full read set — every query the board/list pages run.
  const reads = await Promise.all([
    sb.from("issues").select("id, status, priority, type, custom_values").eq("tenant_id", tenant.id),
    sb.from("projects").select("id, key, name").eq("tenant_id", tenant.id),
    sb.from("tenant_field_options").select("field, key").eq("tenant_id", tenant.id),
    sb.from("tenant_categories").select("id, name").eq("tenant_id", tenant.id),
    sb.from("tenant_custom_fields").select("id, key, label").eq("tenant_id", tenant.id), // the table that broke
  ]);
  const labels = ["issues", "projects", "field options", "categories", "custom fields"];
  reads.forEach((r, i) => check(`board reads: ${labels[i]} (no error)`, !r.error, r.error?.message));

  const [issues, , options] = reads;
  check("board has issues", (issues.data?.length ?? 0) > 0);
  check("statuses are configured", (options.data ?? []).some((o) => o.field === "status"));

  console.log(`\n=== ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed ===\n`);
}

main()
  .catch((e) => { console.error("\nERROR:", e.message); fail++; })
  .finally(() => process.exit(fail === 0 ? 0 : 1));
