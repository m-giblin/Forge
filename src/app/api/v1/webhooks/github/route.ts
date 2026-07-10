import { timingSafeEqual } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service"; // eslint-disable-line no-restricted-imports -- service-role: webhook ingest, no user session (sec09)
import { gitIntegrationRepo } from "@/lib/repositories/gitIntegration";
import { handleGithubWebhook } from "@/lib/services/gitWebhook";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// F-08: plain === on an HMAC result leaks timing information. Same pattern
// as api/email/inbound/route.ts's safeCompareSecret.
function timingSafeStringEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length, 32);
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  bufA.write(a);
  bufB.write(b);
  return timingSafeEqual(bufA, bufB);
}

async function verifySignature(secret: string, body: string, sigHeader: string): Promise<boolean> {
  if (!sigHeader.startsWith("sha256=")) return false;
  const expected = sigHeader.slice(7);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeStringEqual(hex, expected);
}

/** POST /api/v1/webhooks/github — receives GitHub push + pull_request events */
export async function POST(req: Request) {
  const eventType = req.headers.get("x-github-event") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? crypto.randomUUID();
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  // installation_id header we set when configuring the webhook on Forge side
  const installationId = req.headers.get("x-forge-installation") ?? "";

  const body = await req.text();

  try {
    const svc = createSupabaseServiceClient();
    const repo = gitIntegrationRepo(svc);

    // Look up connection by installation_id (tenantId in our simple model)
    // Also allow lookup by the tenant slug passed as a URL param for simpler setup
    const url = new URL(req.url);
    const tenantSlug = url.searchParams.get("tenant") ?? installationId;

    // Resolve tenant
    let tenantId: string | null = null;
    let connectionId: string | null = null;
    let secret: string | null = null;

    if (tenantSlug) {
      const { data: tenant } = await svc.from("tenants").select("id").eq("slug", tenantSlug).maybeSingle();
      if (tenant) {
        tenantId = tenant.id;
        const conn = await repo.getConnection(tenantId as string);
        if (conn) {
          connectionId = conn.id;
          secret = await repo.getWebhookSecret(conn.id);
        }
      }
    }

    if (!tenantId || !connectionId) {
      return new Response(JSON.stringify({ error: "Unknown tenant" }), { status: 404 });
    }

    // Require HMAC — reject if no secret configured or signature missing/invalid.
    // Accepting unsigned payloads would allow anyone to forge webhook events.
    if (!secret) {
      logger.warn("GitHub webhook received but no secret configured", { tenantId });
      return new Response(JSON.stringify({ error: "Webhook secret not configured for this tenant" }), { status: 401 });
    }
    if (!sigHeader) {
      logger.warn("GitHub webhook missing signature header", { tenantId });
      return new Response(JSON.stringify({ error: "Missing X-Hub-Signature-256 header" }), { status: 401 });
    }
    const valid = await verifySignature(secret, body, sigHeader);
    if (!valid) {
      logger.warn("GitHub webhook HMAC mismatch", { tenantId });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    const payload = JSON.parse(body);
    void handleGithubWebhook(tenantId, connectionId, eventType, deliveryId, payload);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    logger.warn("GitHub webhook error", { err: String(e) });
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
}
