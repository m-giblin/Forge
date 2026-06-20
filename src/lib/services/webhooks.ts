import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { webhooksRepo, type WebhookEvent } from "@/lib/repositories/webhooks";
import { logger } from "@/lib/logger";

async function hmacSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deliver(url: string, secret: string, payload: string): Promise<void> {
  const sig = await hmacSignature(secret, payload);
  const headers = {
    "Content-Type": "application/json",
    "X-Forge-Signature": `sha256=${sig}`,
    "X-Forge-Timestamp": Date.now().toString(),
  };

  const attempt = async () =>
    fetch(url, { method: "POST", headers, body: payload, signal: AbortSignal.timeout(10_000) });

  let res = await attempt().catch(() => null);
  // One retry on failure
  if (!res || !res.ok) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await attempt().catch(() => null);
  }
  if (!res || !res.ok) {
    logger.warn("Webhook delivery failed after retry", { url, status: res?.status });
  }
}

export async function fireWebhook(
  tenantId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const svc = createSupabaseServiceClient();
    const endpoints = await webhooksRepo(svc).listEnabledForEvent(tenantId, event);
    if (endpoints.length === 0) return;

    const payload = JSON.stringify({ event, timestamp: new Date().toISOString(), data });

    // Fire all endpoints concurrently, don't await — best-effort background delivery
    for (const ep of endpoints) {
      deliver(ep.url, ep.secret, payload).catch(() => null);
    }
  } catch (e) {
    logger.warn("fireWebhook error", { tenantId, event, err: String(e) });
  }
}
