"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: webhook admin writes (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { webhooksRepo, WEBHOOK_EVENTS } from "@/lib/repositories/webhooks";

function svc() { return webhooksRepo(createSupabaseServiceClient()); }

async function requireAdmin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admins only.");
  return ctx;
}

export async function createWebhookAction(slug: string, formData: FormData): Promise<void> {
  const ctx = await requireAdmin(slug);
  const url = (formData.get("url") as string ?? "").trim();
  if (!url.startsWith("https://") && !url.startsWith("http://")) throw new Error("URL must start with http(s)://");

  const events = WEBHOOK_EVENTS.filter((e) => formData.get(`event_${e}`) === "on");
  if (events.length === 0) throw new Error("Select at least one event.");

  // Generate a random secret the user can copy for verification
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  await svc().create(ctx.tenant.id, { url, secret, events });
  revalidatePath(`/${slug}/admin/settings/webhooks`);
}

export async function toggleWebhookAction(slug: string, id: string, enabled: boolean): Promise<void> {
  const ctx = await requireAdmin(slug);
  await svc().update(ctx.tenant.id, id, { enabled });
  revalidatePath(`/${slug}/admin/settings/webhooks`);
}

export async function deleteWebhookAction(slug: string, id: string): Promise<void> {
  const ctx = await requireAdmin(slug);
  await svc().delete(ctx.tenant.id, id);
  revalidatePath(`/${slug}/admin/settings/webhooks`);
}

export async function revealSecretAction(slug: string, id: string): Promise<string | null> {
  const ctx = await requireAdmin(slug);
  return svc().getSecret(ctx.tenant.id, id);
}

export async function testWebhookAction(slug: string, id: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const ctx = await requireAdmin(slug);
  const endpoints = await svc().listMetadata(ctx.tenant.id);
  const ep = endpoints.find((e) => e.id === id);
  if (!ep) throw new Error("Webhook not found.");
  const secret = await svc().getSecret(ctx.tenant.id, id);
  if (!secret) throw new Error("Webhook secret not found.");

  const payload = JSON.stringify({
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: { message: "This is a test delivery from Forge." },
  });

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forge-Signature": `sha256=${sigHex}`,
        "X-Forge-Timestamp": Date.now().toString(),
      },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}
