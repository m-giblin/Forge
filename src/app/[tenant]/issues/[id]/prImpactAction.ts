"use server";

import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface PrImpactPrediction {
  risk: "low" | "medium" | "high" | "critical";
  scope: string;
  summary: string;
  concerns: string[];
  suggestions: string[];
}

export async function predictPrImpactAction(
  slug: string,
  issueId: string,
): Promise<{ prediction?: PrImpactPrediction; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createSupabaseServerClient();

  const { data: issue } = await supabase
    .from("issues")
    .select("title, description, type, priority")
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!issue) throw new Error("Issue not found.");

  const { data: links } = await supabase
    .from("issue_code_links")
    .select("pr_title, pr_number, repo_full_name, pr_state, link_kind")
    .eq("issue_id", issueId)
    .limit(5);

  const grokKey = process.env.GROK_API_KEY;
  if (!grokKey) {
    return {
      prediction: {
        risk: "medium",
        scope: "component-level",
        summary: "Based on the issue description, this change appears to be moderate in scope. Enable GROK_API_KEY for real AI analysis.",
        concerns: ["Could affect related components", "Testing coverage should be verified"],
        suggestions: ["Add unit tests before merging", "Review with a second set of eyes"],
      },
    };
  }

  const prContext = links && links.length > 0
    ? links.map((l) => `- PR #${l.pr_number}: "${l.pr_title}" (${l.pr_state}) in ${l.repo_full_name}`).join("\n")
    : "No pull requests linked yet.";

  const prompt = `You are a senior software engineer reviewing a pull request before it merges. Assess the risk and impact.

Issue: "${issue.title}"
Type: ${issue.type} | Priority: ${issue.priority}
Description: ${issue.description ? issue.description.slice(0, 500) : "No description provided."}

Linked PRs:
${prContext}

Return a JSON object with:
- risk: "low" | "medium" | "high" | "critical"
- scope: one-phrase scope (e.g., "component-level", "service-wide", "cross-service", "database schema")
- summary: 1-2 sentence plain-English risk assessment
- concerns: array of 2-4 specific risk concerns (short phrases)
- suggestions: array of 2-3 actionable pre-merge suggestions

Return ONLY the JSON object, no prose.`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${grokKey}` },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as PrImpactPrediction;
    return { prediction: parsed };
  } catch {
    return { error: "AI analysis failed. Try again." };
  }
}
