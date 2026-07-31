/**
 * Remove all enrolled MFA factors from the dev founder account so local
 * testing isn't blocked by a TOTP challenge nobody has the secret for.
 * Touches ONE seed account only — no app code, no other users, no tenant data.
 *
 * Run:  node --env-file=.env.local scripts/dev-unenroll-mfa.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/dev-unenroll-mfa.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const DEV_EMAIL = "founder@forge.dev";

async function main() {
  // Find the user by email (admin API paginates; dev DB is small so one page is enough).
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const user = usersPage.users.find((u) => u.email?.toLowerCase() === DEV_EMAIL);
  if (!user) {
    console.log(`No user found for ${DEV_EMAIL} — nothing to do.`);
    return;
  }

  const { data: factors, error: factorErr } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  if (factorErr) throw new Error(`listFactors: ${factorErr.message}`);

  if (!factors.factors.length) {
    console.log(`${DEV_EMAIL} has no enrolled MFA factors already.`);
    return;
  }

  for (const f of factors.factors) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
    if (delErr) throw new Error(`deleteFactor(${f.id}): ${delErr.message}`);
    console.log(`Removed factor ${f.id} (${f.factor_type}) from ${DEV_EMAIL}`);
  }
  console.log("Done — this account can sign in without a TOTP challenge now.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
