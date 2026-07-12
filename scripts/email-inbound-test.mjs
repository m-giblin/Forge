/**
 * Email-inbound pipeline test (FORGE-148, FORGE-150). Exercises
 * /api/email/inbound over HTTP and proves: shared-secret auth is enforced,
 * malformed/unknown payloads are rejected, tenant/project routing resolves
 * correctly (including the near-collision slug edge case FORGE-150 flagged),
 * both known payload shapes parse, HTML bodies get stripped, and the
 * per-tenant rate limit (FORGE-149) actually trips.
 *
 * Requires the dev server running on :3100 with INBOUND_EMAIL_SECRET set.
 * Run:  node --env-file=.env.local scripts/email-inbound-test.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.FORGE_BASE_URL || "http://localhost:3100";
const SECRET = process.env.INBOUND_EMAIL_SECRET;
if (!URL || !SERVICE) { console.error("Missing env."); process.exit(1); }
if (!SECRET) { console.error("Missing INBOUND_EMAIL_SECRET — set it in .env.local"); process.exit(1); }

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();

let pass = 0, fail = 0;
const created = { tenants: [] };
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? "  — " + detail : ""}`); }
}

async function post(body, headers = {}) {
  const res = await fetch(`${BASE}/api/email/inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": SECRET, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function seedTenant(label, slug) {
  const { data: tenant } = await admin.from("tenants").insert({ name: `EmailTest ${label}`, slug }).select().single();
  created.tenants.push(tenant.id);
  await admin.from("projects").insert({ tenant_id: tenant.id, key: "WEB", name: "Web" });
  return tenant;
}

function postmarkPayload({ to, subject = "Something broke", text = "Steps: click the button, it errors.", messageId }) {
  return {
    Subject: subject, TextBody: text, From: "attacker@evil.example", ToFull: [{ Email: to }], To: to,
    ...(messageId ? { MessageID: messageId } : {}),
  };
}

function genericPayload({ to, subject = "Generic shape works too", html = "<p>Body <b>with</b> markup</p>" }) {
  return { subject, html, from: "someone@example.com", to };
}

async function cleanup() {
  for (const id of created.tenants) await admin.from("issues").delete().eq("tenant_id", id);
  for (const id of created.tenants) await admin.from("tenants").delete().eq("id", id);
}

async function main() {
  const slugA = `email-a-${stamp}`;
  const slugCollide = `email-a-${stamp}-corp`; // shares the "email-a-<stamp>" prefix, different slug
  const tenantA = await seedTenant("a", slugA);
  const tenantCollide = await seedTenant("a-corp", slugCollide);

  console.log("Auth:");
  const noSecret = await fetch(`${BASE}/api/email/inbound`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(postmarkPayload({ to: `issues@${slugA}.forge.app` })),
  });
  check("missing secret → 401", noSecret.status === 401);

  const wrongSecret = await fetch(`${BASE}/api/email/inbound`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-webhook-secret": "wrong" },
    body: JSON.stringify(postmarkPayload({ to: `issues@${slugA}.forge.app` })),
  });
  check("wrong secret → 401", wrongSecret.status === 401);

  console.log("\nValidation:");
  const badJson = await post("not json");
  check("malformed body → 400", badJson.status === 400);

  const noSubject = await post({ from: "x@example.com", to: `issues@${slugA}.forge.app` });
  check("unrecognised payload shape → 422", noSubject.status === 422);

  const unknownTenant = await post(postmarkPayload({ to: "issues@does-not-exist.forge.app" }));
  check("unknown tenant slug → 404", unknownTenant.status === 404);

  console.log("\nRouting — Postmark shape, default project:");
  const created1 = await post(postmarkPayload({ to: `issues@${slugA}.forge.app`, subject: "Re: Login broken" }));
  check("creates issue → 200", created1.status === 200, JSON.stringify(created1.json));

  const { data: issue1 } = await admin.from("issues").select("title, description, source, priority, status")
    .eq("id", created1.json?.issueId).maybeSingle();
  check("title has Re: prefix stripped", issue1?.title === "Login broken", issue1?.title);
  check("source = email", issue1?.source === "email");
  check("status = backlog (review-pending)", issue1?.status === "backlog");

  console.log("\nRouting — project-key prefix vs default fallback:");
  const created2 = await post(postmarkPayload({ to: `WEB@${slugA}.forge.app`, subject: "Project-scoped report" }));
  check("project-key routing creates issue → 200", created2.status === 200, JSON.stringify(created2.json));

  console.log("\nRouting — near-collision slugs never cross-route (FORGE-150):");
  const collideCheck = await post(postmarkPayload({ to: `issues@${slugCollide}.forge.app`, subject: "Corp tenant mail" }));
  check("mail to the -corp slug creates its own issue → 200", collideCheck.status === 200);
  const { data: collideIssue } = await admin.from("issues").select("tenant_id").eq("id", collideCheck.json?.issueId).maybeSingle();
  check("routed to the -corp tenant, not the base tenant", collideIssue?.tenant_id === tenantCollide.id,
    `routed to ${collideIssue?.tenant_id}`);
  const { count: baseTenantIssueCount } = await admin.from("issues")
    .select("id", { count: "exact", head: true }).eq("tenant_id", tenantA.id);
  check("base tenant issue count unaffected by -corp mail", baseTenantIssueCount === 2, `count ${baseTenantIssueCount}`);

  console.log("\nPayload shapes — generic (SendGrid-style) + HTML stripping:");
  const created3 = await post(genericPayload({ to: `issues@${slugA}.forge.app` }));
  check("generic payload shape creates issue → 200", created3.status === 200, JSON.stringify(created3.json));
  const { data: issue3 } = await admin.from("issues").select("description").eq("id", created3.json?.issueId).maybeSingle();
  check("HTML body stripped to plain text, sender line prefixed",
    issue3?.description === "Reported via email from: someone@example.com\n\nBody with markup",
    JSON.stringify(issue3?.description));

  console.log("\nIdempotency — same sender emailing twice must both succeed (FORGE-149 regression):");
  const sameSenderFirst = await post(postmarkPayload({ to: `issues@${slugA}.forge.app`, subject: "First question" }));
  const sameSenderSecond = await post(postmarkPayload({ to: `issues@${slugA}.forge.app`, subject: "Second, unrelated question" }));
  check("same sender's second email still creates a NEW issue (not blocked)",
    sameSenderSecond.status === 200 && sameSenderSecond.json?.issueId !== sameSenderFirst.json?.issueId,
    JSON.stringify({ sameSenderFirst, sameSenderSecond }));

  console.log("\nIdempotency — retried webhook delivery (same provider messageId) must not duplicate:");
  const retryId = `msg-${stamp}`;
  const firstDelivery = await post(postmarkPayload({ to: `issues@${slugA}.forge.app`, subject: "Retried delivery", messageId: retryId }));
  const retriedDelivery = await post(postmarkPayload({ to: `issues@${slugA}.forge.app`, subject: "Retried delivery", messageId: retryId }));
  check("retried delivery returns 200 (not a 500)", retriedDelivery.status === 200, JSON.stringify(retriedDelivery.json));
  check("retried delivery returns the SAME issue, not a duplicate",
    retriedDelivery.json?.issueId === firstDelivery.json?.issueId,
    JSON.stringify({ firstDelivery, retriedDelivery }));

  console.log("\nRate limiting (FORGE-149 — 60/tenant/minute):");
  const rlSlug = `email-rl-${stamp}`;
  await seedTenant("rl", rlSlug);
  let sawLimit = false;
  for (let i = 0; i < 62; i++) {
    const res = await post(postmarkPayload({ to: `issues@${rlSlug}.forge.app`, subject: `Burst ${i}` }));
    if (res.status === 429) { sawLimit = true; break; }
  }
  check("61st+ request in the same minute trips 429", sawLimit);

  console.log(`\n=== ${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed ===\n`);
}

main()
  .catch((e) => { console.error("\nERROR:", e.message); fail++; })
  .finally(async () => { await cleanup().catch(() => {}); process.exit(fail === 0 ? 0 : 1); });
