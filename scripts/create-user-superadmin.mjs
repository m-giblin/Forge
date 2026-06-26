/**
 * Create a Supabase auth account + app user row + super-admin grant.
 * Usage: node --env-file=.env.local scripts/create-user-superadmin.mjs <email> [displayName]
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const displayName = process.argv[3] ?? null;

if (!URL || !SERVICE || !email) {
  console.error("Usage: node --env-file=.env.local scripts/create-user-superadmin.mjs <email> [displayName]");
  process.exit(1);
}

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });

(async () => {
  // 1. Create auth user (invite flow — they'll get a magic-link / set-password email)
  const { data: authData, error: authErr } = await svc.auth.admin.inviteUserByEmail(email, {
    data: { full_name: displayName },
  });
  if (authErr && !authErr.message.includes("already been registered")) throw authErr;

  // 2. Look up auth user id
  const { data: { users }, error: listErr } = await svc.auth.admin.listUsers();
  if (listErr) throw listErr;
  const authUser = users.find((u) => u.email === email);
  if (!authUser) throw new Error(`Could not find auth user for ${email}`);

  // 3. Upsert app user row
  const { data: appUser, error: upsertErr } = await svc
    .from("users")
    .upsert(
      { auth_id: authUser.id, email, name: displayName },
      { onConflict: "auth_id", ignoreDuplicates: false }
    )
    .select("id")
    .maybeSingle();
  if (upsertErr) throw upsertErr;

  // If upsert returned nothing (row existed), fetch it
  let appUserId = appUser?.id;
  if (!appUserId) {
    const { data: existing } = await svc.from("users").select("id").eq("auth_id", authUser.id).maybeSingle();
    appUserId = existing?.id;
  }
  if (!appUserId) throw new Error("Could not resolve app user id");

  // 4. Grant super-admin
  const { error: saErr } = await svc
    .from("super_admins")
    .upsert({ user_id: appUserId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (saErr) throw saErr;

  console.log(`\n✅ Done!`);
  console.log(`   Email:        ${email}`);
  console.log(`   Auth ID:      ${authUser.id}`);
  console.log(`   App user ID:  ${appUserId}`);
  console.log(`   Super-admin:  granted`);
  console.log(`\n   An invitation email has been sent to ${email}.`);
  console.log(`   They must click the link to set their password before logging in.\n`);
})().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
