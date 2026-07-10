import "server-only";
import { grokComplete } from "@/lib/services/grokAi";

const SYSTEM_PROMPT =
  "You are a SaaS platform support triage assistant for Forge, a multi-tenant issue tracking SaaS. " +
  "Analyze the support ticket and provide: " +
  "1) A one-paragraph triage summary (likely cause, severity, category), " +
  "2) Step-by-step guidance for the platform admin to resolve or investigate. " +
  'Respond ONLY with valid JSON in this exact shape: {"summary": "...", "guidance": "..."}';

export async function triageSupportTicket(ticket: {
  tenantId: string;
  title: string;
  body: string;
  tenantName: string;
}): Promise<{ summary: string; guidance: string }> {
  const fallback = {
    summary: "Triage unavailable",
    guidance: "Please review the ticket manually.",
  };

  try {
    const userPrompt =
      `Tenant: ${ticket.tenantName}\n` +
      `Title: ${ticket.title}\n\n` +
      `Body:\n${ticket.body}`;

    const text = await grokComplete(ticket.tenantId, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ], { temperature: 0.4, maxTokens: 1024, feature: "support_triage" });

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
