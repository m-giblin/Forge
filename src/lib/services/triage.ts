import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo, type TriageSuggestion } from "@/lib/repositories/issues";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

async function callGrok(prompt: string): Promise<string> {
  const env = serverEnv();
  if (!env.GROK_API_KEY) throw new Error("GROK_API_KEY not set");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROK_API_KEY}` },
    body: JSON.stringify({
      model: "grok-3-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Grok ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function triageIssue(tenantId: string, issueId: string): Promise<TriageSuggestion | null> {
  try {
    const svc = createSupabaseServiceClient();
    const issue = await issuesRepo(svc).get(tenantId, issueId);
    if (!issue) return null;

    // Fetch tenant's valid priorities and categories for context
    const [allOptions, categories, recentIssues] = await Promise.all([
      fieldConfigRepo(svc).listOptions(tenantId),
      fieldConfigRepo(svc).listCategories(tenantId),
      svc.from("issues")
        .select("id, title")
        .eq("tenant_id", tenantId)
        .neq("id", issueId)
        .order("created_at", { ascending: false })
        .limit(30)
        .then((r) => r.data ?? []),
    ]);

    const priorityKeys = allOptions.filter((o) => o.field === "priority").map((p) => p.key).join(", ");
    const categoryList = categories.map((c) => `"${c.name}"`).join(", ");
    const recentTitles = recentIssues.map((i, n) => `${n + 1}. ${i.title}`).join("\n");

    const prompt = `You are a bug triage assistant for a software team. Analyze this issue and respond with ONLY valid JSON — no markdown, no explanation.

ISSUE TITLE: ${issue.title}
ISSUE DESCRIPTION: ${issue.description ?? "(none)"}
CURRENT PRIORITY: ${issue.priority}
ISSUE TYPE: ${issue.type}

VALID PRIORITIES: ${priorityKeys}
VALID CATEGORIES: ${categoryList || "(none configured)"}

RECENT ISSUES (for duplicate detection):
${recentTitles || "(none)"}

Respond with this exact JSON structure:
{
  "priority": "<one of the valid priorities>",
  "categoryLabel": "<one of the valid categories, or null>",
  "duplicateTitles": ["<title of likely duplicate if found, else empty array>"],
  "reasoning": "<2-3 sentence explanation of your suggestions>"
}`;

    const raw = await callGrok(prompt);

    // Strip markdown fences if model wraps the JSON
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      priority: string;
      categoryLabel: string | null;
      duplicateTitles: string[];
      reasoning: string;
    };

    const suggestion: TriageSuggestion = {
      priority: parsed.priority,
      categoryLabel: parsed.categoryLabel ?? null, // matched against category.name
      duplicateTitles: Array.isArray(parsed.duplicateTitles) ? parsed.duplicateTitles.slice(0, 3) : [],
      reasoning: parsed.reasoning ?? "",
      generatedAt: new Date().toISOString(),
    };

    // Persist to the issue row
    await svc.from("issues")
      .update({ triage_suggestion: suggestion })
      .eq("tenant_id", tenantId)
      .eq("id", issueId);

    return suggestion;
  } catch (e) {
    logger.warn("AI triage failed", { tenantId, issueId, err: String(e) });
    return null;
  }
}

export async function clearTriage(tenantId: string, issueId: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc.from("issues").update({ triage_suggestion: null }).eq("tenant_id", tenantId).eq("id", issueId);
}
