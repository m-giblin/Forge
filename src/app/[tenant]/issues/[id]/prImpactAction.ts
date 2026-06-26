"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role required for risk gate writes
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueRiskGatesRepo } from "@/lib/repositories/issueRiskGates";
import { issueActivityRepo } from "@/lib/repositories/issueActivity";

export interface PrImpactPrediction {
  risk: "low" | "medium" | "high" | "critical";
  scope: string;
  summary: string;
  concerns: string[];
  suggestions: string[];
}

export async function predictPrImpactAction(
  slug: string,
  issueId: string,
): Promise<{ prediction?: PrImpactPrediction; gateId?: string; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createSupabaseServerClient();
  const svc = createSupabaseServiceClient();

  const { data: issue } = await supabase
    .from("issues")
    .select("title, description, type, priority, number, projects!inner(key)")
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
  let prediction: PrImpactPrediction;

  if (!grokKey) {
    prediction = {
      risk: "medium",
      scope: "component-level",
      summary: "Based on the issue description, this change appears to be moderate in scope. Enable GROK_API_KEY for real AI analysis.",
      concerns: ["Could affect related components", "Testing coverage should be verified"],
      suggestions: ["Add unit tests before merging", "Review with a second set of eyes"],
    };
  } else {
    const prContext = links && links.length > 0
      ? links.map((l) => `- PR #${l.pr_number}: "${l.pr_title}" (${l.pr_state}) in ${l.repo_full_name}`).join("\n")
      : "No pull requests linked yet.";

    const prompt = `You are a senior software engineer reviewing a pull request before it merges. Assess the risk and impact.

Issue: "${(issue.title as string).slice(0, 200)}"
Type: ${issue.type} | Priority: ${issue.priority}
Description: ${issue.description ? (issue.description as string).slice(0, 500) : "No description provided."}

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
      prediction = JSON.parse(clean) as PrImpactPrediction;
    } catch {
      return { error: "AI analysis failed. Try again." };
    }
  }

  const activity = issueActivityRepo(svc);

  // Always log the prediction run as a system comment
  const riskEmoji = { low: "🟢", medium: "🟡", high: "🟠", critical: "🔴" }[prediction.risk] ?? "⚪";
  const runComment = [
    `**PR Impact Analysis** ${riskEmoji} **${prediction.risk.toUpperCase()} RISK** · Scope: ${prediction.scope}`,
    ``,
    prediction.summary,
    prediction.concerns.length > 0
      ? `\n**Concerns**\n${prediction.concerns.map((c) => `- ⚠ ${c}`).join("\n")}`
      : "",
    prediction.suggestions.length > 0
      ? `\n**Suggestions**\n${prediction.suggestions.map((s) => `- ✓ ${s}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");

  await activity.addComment({
    tenantId: ctx.tenant.id,
    issueId,
    authorId: null,
    authorLabel: "PR Impact",
    body: runComment,
  });

  // Create risk gate for High or Critical
  let gateId: string | undefined;
  if (prediction.risk === "high" || prediction.risk === "critical") {
    const gate = await issueRiskGatesRepo(svc).createGate({
      tenantId: ctx.tenant.id,
      issueId,
      riskLevel: prediction.risk,
      predictionJson: prediction as unknown as Record<string, unknown>,
      triggeredBy: ctx.appUserId ?? null,
    });
    gateId = gate.id;

    await activity.addComment({
      tenantId: ctx.tenant.id,
      issueId,
      authorId: null,
      authorLabel: "Risk Gate",
      body: `🚨 **Risk gate opened** — ${prediction.risk.toUpperCase()} risk detected.\n\nThis issue is now **blocked from closing** until a project manager or admin reviews and approves or denies the gate.`,
    });
  }

  revalidatePath(`/${slug}/issues/${issueId}`);
  revalidatePath(`/${slug}/board`);

  return { prediction, gateId };
}

export async function reviewRiskGateAction(
  slug: string,
  issueId: string,
  gateId: string,
  decision: "approved" | "denied",
  reason: string,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("Only project managers and admins can review risk gates.");
  }
  if (!reason.trim()) throw new Error("A reason is required.");

  const svc = createSupabaseServiceClient();
  const repo = issueRiskGatesRepo(svc);

  await repo.reviewGate({
    gateId,
    tenantId: ctx.tenant.id,
    state: decision,
    reviewedBy: ctx.appUserId!,
    reviewReason: reason.trim(),
  });

  const verb = decision === "approved" ? "approved" : "denied";
  const emoji = decision === "approved" ? "✅" : "❌";

  await issueActivityRepo(svc).addComment({
    tenantId: ctx.tenant.id,
    issueId,
    authorId: null,
    authorLabel: "Risk Gate",
    body: `${emoji} **Risk gate ${verb}** by ${ctx.email}\n\n_"${reason.trim()}"_\n\n${
      decision === "approved"
        ? "This issue may now be moved to done."
        : "This issue remains blocked. Address the concerns and re-run PR Impact to lift the gate."
    }`,
  });

  revalidatePath(`/${slug}/issues/${issueId}`);
  revalidatePath(`/${slug}/board`);
  revalidatePath(`/${slug}/morning`);
}

export async function createActionItemsFromPredictionAction(
  slug: string,
  issueId: string,
  suggestions: string[],
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot create issues.");

  const supabase = await createSupabaseServerClient();
  const svc = createSupabaseServiceClient();

  const { data: issue } = await supabase
    .from("issues")
    .select("project_id, projects!inner(key)")
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!issue) throw new Error("Issue not found.");

  // Get max issue number for this project
  const { data: maxRow } = await svc
    .from("issues")
    .select("number")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", issue.project_id)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = ((maxRow?.number as number) ?? 0) + 1;

  for (const suggestion of suggestions) {
    await svc.from("issues").insert({
      tenant_id: ctx.tenant.id,
      project_id: issue.project_id,
      number: nextNumber++,
      title: suggestion,
      type: "task",
      priority: "medium",
      status: "todo",
      parent_issue_id: issueId,
    });
  }

  await issueActivityRepo(svc).addComment({
    tenantId: ctx.tenant.id,
    issueId,
    authorId: null,
    authorLabel: "PR Impact",
    body: `📋 **${suggestions.length} action item${suggestions.length !== 1 ? "s" : ""} created** from PR Impact suggestions:\n\n${suggestions.map((s) => `- ${s}`).join("\n")}`,
  });

  revalidatePath(`/${slug}/issues/${issueId}`);
  revalidatePath(`/${slug}/board`);
}
