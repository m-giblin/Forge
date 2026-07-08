import "server-only";
// eslint-disable-next-line no-restricted-imports -- service-role: AI key lookup (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { serverEnv } from "@/lib/env";

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

export async function getGrokApiKey(tenantId: string): Promise<string> {
  const svc = createSupabaseServiceClient();
  const { data: keyRow } = await svc
    .from("tenant_ai_keys")
    .select("key_enc, key_nonce, key_tag")
    .eq("tenant_id", tenantId)
    .eq("provider", "xai")
    .eq("is_active", true)
    .maybeSingle();

  const apiKey = keyRow ? await decryptKey(keyRow) : serverEnv().GROK_API_KEY;
  if (!apiKey) throw new Error("No AI key configured. Add an xAI key in Admin → AI Settings.");
  return apiKey;
}

export async function grokComplete(
  tenantId: string,
  prompt: string,
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = await getGrokApiKey(tenantId);
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: opts.model ?? "grok-3-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 800,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Grok API error ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
