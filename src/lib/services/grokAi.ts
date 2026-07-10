import "server-only";
// eslint-disable-next-line no-restricted-imports -- service-role: AI key lookup + usage metering (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getTenantSettings } from "@/lib/tenantSettings";

// F-05: no PII masking existed before outbound content left the trust
// boundary to xAI. Best-effort regex scrub for the two highest-value,
// lowest-false-positive patterns — not a full PII/NLP solution, but a real
// reduction for the common case (an email or phone number quoted in an
// issue/comment/commit message). Opt-in per tenant via ai_pii_scrub setting,
// since redaction can degrade AI output quality for tenants who want full
// context (e.g. Think Tank discussing a named customer).
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

function scrubPii(text: string): string {
  return text.replace(EMAIL_RE, "[redacted-email]").replace(PHONE_RE, "[redacted-phone]");
}

async function decryptKey(row: { key_enc: string; key_nonce: string; key_tag: string }): Promise<string | null> {
  try {
    const secret = process.env.FORGE_AI_KEY_SECRET;
    if (!secret) return null;
    const keyMat = await crypto.subtle.importKey("raw", Buffer.from(secret, "hex"), "AES-GCM", false, ["decrypt"]);
    const iv = Buffer.from(row.key_nonce, "base64");
    const ciphertext = Buffer.from(row.key_enc, "base64");
    const tag = Buffer.from(row.key_tag, "base64");
    const combined = Buffer.concat([ciphertext, tag]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyMat, combined);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Resolves the tenant's own xAI key (BYO) or falls back to the platform key, and reports which one was used — the caller no longer needs to know or care. */
async function resolveGrokKey(tenantId: string): Promise<{ apiKey: string; keySource: "platform" | "byo" }> {
  const svc = createSupabaseServiceClient();
  const { data: keyRow } = await svc
    .from("tenant_ai_keys")
    .select("key_enc, key_nonce, key_tag")
    .eq("tenant_id", tenantId)
    .eq("provider", "xai")
    .eq("is_active", true)
    .maybeSingle();

  if (keyRow) {
    const decrypted = await decryptKey(keyRow);
    if (decrypted) return { apiKey: decrypted, keySource: "byo" };
  }
  const platformKey = serverEnv().GROK_API_KEY;
  if (!platformKey) throw new Error("No AI key configured. Add an xAI key in Admin → AI Settings.");
  return { apiKey: platformKey, keySource: "platform" };
}

/** @deprecated Use grokComplete(), which resolves the key internally and meters usage. Kept only for call sites not yet migrated. */
export async function getGrokApiKey(tenantId: string): Promise<string> {
  return (await resolveGrokKey(tenantId)).apiKey;
}

// $ per 1M tokens (input, output). Only grok-3-mini is used in Forge today;
// keyed by model so a future model change doesn't silently mis-price history.
const GROK_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  "grok-3-mini": { inputPerM: 0.30, outputPerM: 0.50 },
  // Rough reference pricing for BYO providers used by the Think Tank Sounding
  // Board (src/lib/ai/service.ts) — informational only, since BYO usage is
  // the tenant's own bill, not Forge's. Keeps the usage dashboard meaningful
  // even for non-xAI providers rather than showing $0 for all of them.
  "gpt-4o": { inputPerM: 2.50, outputPerM: 10.00 },
  "claude-sonnet-4-6": { inputPerM: 3.00, outputPerM: 15.00 },
  "gemini-2.0-flash": { inputPerM: 0.10, outputPerM: 0.40 },
};

/**
 * Best-effort usage log — a metering failure must never break the AI feature
 * that triggered it. Exported for callSoundingBoard (lib/ai/service.ts),
 * the one multi-provider AI call site that can't go through grokComplete().
 */
export async function recordAiUsage(input: {
  tenantId: string;
  feature: string;
  model: string;
  keySource: "platform" | "byo";
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    const price = GROK_PRICING[input.model] ?? GROK_PRICING["grok-3-mini"];
    const costHundredthCents = Math.round(
      (input.inputTokens * price.inputPerM + input.outputTokens * price.outputPerM) / 1_000_000 * 1_000_000
    );
    // (tokens * $/1M) / 1M gives dollars; * 1,000,000 converts dollars to hundredths-of-a-cent.
    const svc = createSupabaseServiceClient();
    await svc.from("ai_usage_events").insert({
      tenant_id: input.tenantId,
      feature: input.feature,
      model: input.model,
      key_source: input.keySource,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      est_cost_hundredth_cents: costHundredthCents,
    });
  } catch (e) {
    logger.warn("AI usage metering write failed (non-fatal)", { feature: input.feature, error: e instanceof Error ? e.message : String(e) });
  }
}

export type GrokMessage = { role: "system" | "user"; content: string };

/**
 * The single choke point every Grok call in Forge should go through.
 * - Resolves the tenant's BYO xAI key first, falling back to the platform key.
 * - Meters real token usage (from the API's own `usage` field) per tenant/feature,
 *   tagged with which key paid for it — the basis for both cost control and,
 *   eventually, billing platform-key usage back to tenants who don't BYO.
 *
 * `feature` is a short stable tag (e.g. "pr_impact", "standup_digest") — used
 * as the grouping key in usage reports, so keep it consistent across calls
 * for the same feature rather than inventing a new string each time.
 */
export async function grokComplete(
  tenantId: string,
  promptOrMessages: string | GrokMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; feature: string },
): Promise<string> {
  // F-05: per-tenant kill switch for AI features, independent of any
  // individual feature flag — a privacy-sensitive customer can opt out of
  // every AI feature at once rather than one flag at a time.
  const tenantAiSettings = await getTenantSettings(tenantId, ["ai_disabled", "ai_pii_scrub"]);
  if (tenantAiSettings.ai_disabled === "true") {
    throw new Error("AI features are disabled for this workspace.");
  }

  const { apiKey, keySource } = await resolveGrokKey(tenantId);
  const model = opts.model ?? "grok-3-mini";
  let messages: GrokMessage[] = typeof promptOrMessages === "string"
    ? [{ role: "user", content: promptOrMessages }]
    : promptOrMessages;

  if (tenantAiSettings.ai_pii_scrub === "true") {
    messages = messages.map((m) => ({ ...m, content: scrubPii(m.content) }));
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 800,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Grok API error ${res.status}`);
  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  void recordAiUsage({
    tenantId, feature: opts.feature, model, keySource,
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  });

  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
