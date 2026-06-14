/**
 * Mint a tenant-scoped API key. Prints the raw key ONCE — it is never
 * recoverable (only its hash is stored).
 *
 * Run:  node --env-file=.env.local scripts/issue-api-key.mjs [tenantSlug] [name] [scopes]
 *   tenantSlug default "travli"
 *   name        default "Integration"
 *   scopes      default "issues:read,issues:write"
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing env. Run: node --env-file=.env.local scripts/issue-api-key.mjs");
  process.exit(1);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const slug = process.argv[2] || "travli";
const name = process.argv[3] || "Integration";
const scopes = (process.argv[4] || "issues:read,issues:write").split(",").map((s) => s.trim());

const hashKey = (raw) => createHash("sha256").update(raw).digest("hex");

(async () => {
  const { data: tenant, error: tErr } = await admin
    .from("tenants").select("id, slug").eq("slug", slug).maybeSingle();
  if (tErr || !tenant) throw new Error(`No tenant with slug "${slug}". Run seed:dev first.`);

  const raw = `forge_${slug}_${randomBytes(24).toString("hex")}`;
  const { error } = await admin.from("api_keys").insert({
    tenant_id: tenant.id,
    name,
    key_prefix: raw.slice(0, 20),
    key_hash: hashKey(raw),
    scopes,
  });
  if (error) throw new Error(`insert key: ${error.message}`);

  console.log("\n✅ API key minted (store it now — shown only once):\n");
  console.log(`   ${raw}\n`);
  console.log(`   tenant: ${slug}   scopes: ${scopes.join(", ")}\n`);
})().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
