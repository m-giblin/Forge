import "server-only";
import { serverEnv } from "@/lib/env";

const GROK_BASE_URL = "https://api.x.ai/v1";
const GROK_MODEL = "grok-3-mini";

const SYSTEM_PROMPT =
  "You are a SaaS platform support triage assistant for Forge, a multi-tenant issue tracking SaaS. " +
  "Analyze the support ticket and provide: " +
  "1) A one-paragraph triage summary (likely cause, severity, category), " +
  "2) Step-by-step guidance for the platform admin to resolve or investigate. " +
  'Respond ONLY with valid JSON in this exact shape: {"summary": "...", "guidance": "..."}';

export async function triageSupportTicket(ticket: {
  title: string;
  body: string;
  tenantName: string;
}): Promise<{ summary: string; guidance: string }> {
  const fallback = {
    summary: "Triage unavailable",
    guidance: "Please review the ticket manually.",
  };

  try {
    const env = serverEnv();
    const apiKey = env.GROK_API_KEY;
    if (!apiKey) return fallback;

    const userPrompt =
      `Tenant: ${ticket.tenantName}\n` +
      `Title: ${ticket.title}\n\n` +
      `Body:\n${ticket.body}`;

    const res = await fetch(`${GROK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return fallback;

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return fallback;

    // Strip markdown code fences if the model wraps the JSON
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(stripped) as { summary?: string; guidance?: string };

    return {
      summary: parsed.summary ?? fallback.summary,
      guidance: parsed.guidance ?? fallback.guidance,
    };
  } catch {
    return fallback;
  }
}
