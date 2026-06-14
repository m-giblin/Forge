/**
 * Grant platform super-admin to a user by email. Out-of-band only — there is
 * no in-app way to become a super admin.
 *
 * Run:  node --env-file=.env.local scripts/make-super-admin.mjs <email>
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
if (!URL || !SERVICE || !email) {
  console.error("Usage: node --env-file=.env.local scripts/make-super-admin.mjs <email>");
  process.exit(1);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

(async () => {
  const { data: user, error } = await admin.from("users").select("id, email").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!user) throw new Error(`No user with email ${email}. They must have signed in at least once.`);

  const { error: insErr } = await admin
    .from("super_admins")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (insErr) throw insErr;

  console.log(`\n✅ ${email} is now a platform super admin.\n`);
})().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
