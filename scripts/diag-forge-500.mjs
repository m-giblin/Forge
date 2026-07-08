#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv("/Users/mgiblin/Projects/se-enablement-platform/.env.local");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cat = await admin.from("tenant_categories").select("id, project_id").limit(1);
console.log("tenant_categories.project_id:", cat.error ? `ERROR: ${cat.error.message}` : `OK (${cat.data?.length ?? 0} rows)`);

const rl = await admin.rpc("rl_increment", { p_key: "diag-test", p_window_ms: 60_000 });
console.log("rl_increment RPC:", rl.error ? `ERROR: ${rl.error.message}` : `OK count=${rl.data?.[0]?.new_count}`);

const { data: projects } = await admin.from("projects").select("id, key, tenant_id, name").eq("key", "SEENA");
console.log("SEENA projects:", projects ?? []);

if (projects?.[0]) {
  const pm = await admin
    .from("project_members")
    .select("id, role, created_at, user:users!inner(id, email, name)")
    .eq("project_id", projects[0].id);
  console.log("project_members join:", pm.error ? `ERROR: ${pm.error.message}` : `OK (${pm.data?.length ?? 0} members)`);
  for (const row of pm.data ?? []) {
    const user = Array.isArray(row.user) ? row.user[0] : row.user;
    console.log(`  - ${user?.name} <${user?.email}> userId=${user?.id}`);
  }
}

const seKey = process.env.FORGE_API_KEY?.trim();
if (seKey && process.env.API_KEY_HASH_SECRET) {
  const hash = createHmac("sha256", process.env.API_KEY_HASH_SECRET).update(seKey).digest("hex");
  const { data: keyRow, error: keyErr } = await admin
    .from("api_keys")
    .select("id, tenant_id, scopes, revoked_at, key_prefix")
    .eq("key_hash", hash)
    .maybeSingle();
  if (keyErr) console.log("api_keys lookup error:", keyErr.message);
  else if (!keyRow) console.log("api_keys lookup: NOT FOUND for SE platform FORGE_API_KEY");
  else {
    console.log("api_keys lookup: FOUND", {
      prefix: keyRow.key_prefix,
      tenant_id: keyRow.tenant_id,
      scopes: keyRow.scopes,
      revoked: Boolean(keyRow.revoked_at),
    });
    const sameTenant = projects?.some((p) => p.tenant_id === keyRow.tenant_id);
    console.log("API key tenant owns SEENA project:", sameTenant);
  }
} else {
  console.log("Skip api key lookup — API_KEY_HASH_SECRET or FORGE_API_KEY missing in loaded env");
}
