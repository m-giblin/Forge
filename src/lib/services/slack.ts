import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { encryptSecret, decryptSecret } from "@/lib/encryption";

// F-08: plain string equality on an HMAC result leaks timing information.
// Same pattern as api/email/inbound/route.ts's safeCompareSecret — pad to a
// common length first so length itself isn't a timing oracle either.
function timingSafeStringEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length, 32);
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  bufA.write(a);
  bufB.write(b);
  return timingSafeEqual(bufA, bufB);
}


// Values are stored as `enc:<base64json>` when encrypted so we can detect and
// decrypt them transparently. Plain values (e.g. from before encryption was
// added, or non-secret keys like workspace_id) pass through unchanged.
function encodeSecret(plaintext: string, tenantId: string): string {
  const { enc, nonce, tag } = encryptSecret(plaintext, tenantId);
  return `enc:${JSON.stringify({ enc, nonce, tag })}`;
}

function decodeValue(raw: string, tenantId: string): string {
  if (!raw.startsWith("enc:")) return raw; // plaintext (workspace_id or legacy row)
  try {
    const { enc, nonce, tag } = JSON.parse(raw.slice(4)) as { enc: string; nonce: string; tag: string };
    return decryptSecret(enc, nonce, tag, tenantId);
  } catch {
    return raw; // corrupt/legacy — surface as-is rather than crashing
  }
}

// --- Credential helpers (per-tenant, stored in platform_config) ---

export async function getSlackConfig(tenantId: string): Promise<{
  botToken: string;
  signingSecret: string;
  workspaceId: string;
} | null> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("key, value")
    .eq("tenant_id", tenantId)
    .in("key", ["slack_bot_token", "slack_signing_secret", "slack_workspace_id"]);

  const map = Object.fromEntries(
    (data ?? []).map((r) => [r.key as string, decodeValue(r.value as string, tenantId)])
  );
  if (!map.slack_bot_token || !map.slack_signing_secret || !map.slack_workspace_id) return null;
  return {
    botToken: map.slack_bot_token,
    signingSecret: map.slack_signing_secret,
    workspaceId: map.slack_workspace_id,
  };
}

export async function saveSlackConfig(
  tenantId: string,
  config: { botToken?: string; signingSecret?: string; workspaceId?: string }
): Promise<void> {
  const svc = createSupabaseServiceClient();
  const rows = [
    config.botToken !== undefined
      ? { tenant_id: tenantId, key: "slack_bot_token", value: encodeSecret(config.botToken, tenantId) }
      : null,
    config.signingSecret !== undefined
      ? { tenant_id: tenantId, key: "slack_signing_secret", value: encodeSecret(config.signingSecret, tenantId) }
      : null,
    config.workspaceId !== undefined
      ? { tenant_id: tenantId, key: "slack_workspace_id", value: config.workspaceId }
      : null,
  ].filter(Boolean) as { tenant_id: string; key: string; value: string }[];

  if (rows.length === 0) return;
  await svc.from("platform_config").upsert(rows, { onConflict: "tenant_id,key" });
}

export async function clearSlackConfig(tenantId: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc
    .from("platform_config")
    .delete()
    .eq("tenant_id", tenantId)
    .in("key", ["slack_bot_token", "slack_signing_secret", "slack_workspace_id"]);
}

// --- Tenant lookup by Slack workspace ID ---

export async function getTenantByWorkspaceId(workspaceId: string): Promise<string | null> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("tenant_id")
    .eq("key", "slack_workspace_id")
    .eq("value", workspaceId)
    .maybeSingle();
  return (data?.tenant_id as string) ?? null;
}

// --- Slack request signature verification ---

export async function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `v0=${hex}`;
  return timingSafeStringEqual(expected, signature);
}

// --- Issue creation from Slack ---

export async function createIssueFromSlack(
  tenantId: string,
  title: string,
  description: string | null
): Promise<{ key: string; id: string } | null> {
  const svc = createSupabaseServiceClient();
  const project = await projectsRepo(svc).getDefault(tenantId);
  if (!project) return null;

  // Use service-role insert — no user JWT available in a bot context
  const { data: issue, error } = await svc
    .from("issues")
    .insert({
      tenant_id: tenantId,
      project_id: project.id,
      title: title.slice(0, 255),
      description: description ?? null,
      status: "todo",
      priority: "medium",
      type: "bug",
      source: "slack",
      custom_values: {},
    })
    .select("id, key")
    .single();

  if (error) {
    console.error("[slack] issue insert error", error);
    return null;
  }
  return { key: issue.key as string, id: issue.id as string };
}

// --- Slack API helpers ---

export async function postEphemeral(
  botToken: string,
  channel: string,
  user: string,
  text: string
): Promise<void> {
  await fetch("https://slack.com/api/chat.postEphemeral", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({ channel, user, text }),
  });
}

export async function fetchMessage(
  botToken: string,
  channel: string,
  ts: string
): Promise<string | null> {
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channel}&latest=${ts}&inclusive=true&limit=1`,
    { headers: { Authorization: `Bearer ${botToken}` } }
  );
  const json = await res.json() as { ok: boolean; messages?: Array<{ text: string }> };
  return json.ok && json.messages?.[0]?.text ? json.messages[0].text : null;
}
