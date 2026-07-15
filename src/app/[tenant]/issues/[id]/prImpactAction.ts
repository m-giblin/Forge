"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- service-role required for risk gate writes
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueRiskGatesRepo } from "@/lib/repositories/issueRiskGates";
import { issueActivityRepo } from "@/lib/repositories/issueActivity";
import { gitIntegrationRepo } from "@/lib/repositories/gitIntegration";
import { grokComplete } from "@/lib/services/grokAi";

// Matches the constant in IssueDetail.tsx / the attachments route — not
// imported from either to avoid pulling a route module or client component
// into this server action's bundle.
const REPLAY_CONTENT_TYPE = "application/x-forge-replay+json";

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

  let prediction: PrImpactPrediction;

  const prContext = links && links.length > 0
    ? links.map((l) => `- PR #${l.pr_number}: "${l.pr_title}" (${l.pr_state}) in ${l.repo_full_name}`).join("\n")
    : "No pull requests linked yet.";

  // File-path-to-bug-history correlation (FORGE-71 fast-follow): does this
  // change touch files with a track record of bugs? Built entirely from data
  // already flowing in over the existing push-webhook handler (commit
  // added/removed/modified file lists) — no separate GitHub API call.
  const gitRepo = gitIntegrationRepo(svc);
  const touchedFiles = await gitRepo.getFilePathsForIssue(ctx.tenant.id, issueId);
  const fileHistoryContext = await (async () => {
    if (touchedFiles.length === 0) return "No file history available yet (no commits linked to this issue).";
    const correlated = await gitRepo.findIssuesTouchingFiles(ctx.tenant.id, touchedFiles, issueId, 8);
    if (correlated.length === 0) return `Touches ${touchedFiles.length} file(s); no prior bugs found on record for these paths.`;

    const correlatedIssueIds = [...new Set(correlated.map((c) => c.issueId))];
    const [{ data: pastIssues }, { data: replayAttachments }] = await Promise.all([
      svc.from("issues").select("id, title, projects!inner(key), number").in("id", correlatedIssueIds),
      svc.from("issue_attachments").select("issue_id").in("issue_id", correlatedIssueIds).eq("content_type", REPLAY_CONTENT_TYPE),
    ]);
    const replayIssueIds = new Set((replayAttachments ?? []).map((a) => a.issue_id as string));
    const lines = (pastIssues ?? []).slice(0, 6).map((pi) => {
      const key = `${(pi.projects as unknown as { key: string }).key}-${pi.number}`;
      const filePath = correlated.find((c) => c.issueId === pi.id)?.filePath ?? "";
      const replayNote = replayIssueIds.has(pi.id as string) ? " (had a session replay — likely a real user-facing repro, not just a code smell)" : "";
      return `- ${key}: "${(pi.title as string).slice(0, 100)}" touched ${filePath}${replayNote}`;
    });
    return `Touches ${touchedFiles.length} file(s) with prior bug history — ${correlatedIssueIds.length} past issue(s) touched the same files:\n${lines.join("\n")}`;
  })();

  const prompt = `You are a senior software engineer reviewing a pull request before it merges. Assess the risk and impact.

Issue: "${(issue.title as string).slice(0, 200)}"
Type: ${issue.type} | Priority: ${issue.priority}
Description: ${issue.description ? (issue.description as string).slice(0, 500) : "No description provided."}

Linked PRs:
${prContext}

File-path bug history:
${fileHistoryContext}

Return a JSON object with:
- risk: "low" | "medium" | "high" | "critical"
- scope: one-phrase scope (e.g., "component-level", "service-wide", "cross-service", "database schema")
- summary: 1-2 sentence plain-English risk assessment
- concerns: array of 2-4 specific risk concerns (short phrases)
- suggestions: array of 2-3 actionable pre-merge suggestions

Return ONLY the JSON object, no prose.`;

  try {
    const raw = await grokComplete(ctx.tenant.id, prompt, { temperature: 0.3, maxTokens: 600, feature: "pr_impact" });
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    prediction = JSON.parse(clean) as PrImpactPrediction;
  } catch (e) {
    if (e instanceof Error && e.message.includes("No AI key configured")) {
      prediction = {
        risk: "medium",
        scope: "component-level",
        summary: "Based on the issue description, this change appears to be moderate in scope. Enable GROK_API_KEY for real AI analysis.",
        concerns: ["Could affect related components", "Testing coverage should be verified"],
        suggestions: ["Add unit tests before merging", "Review with a second set of eyes"],
      };
    } else {
      return { error: "AI analysis failed. Try again." };
    }
  }

  const activity = issueActivityRepo(svc);

  // Persist latest prediction on the issue for dashboard + badge
  await svc
    .from("issues")
    .update({
      latest_pr_impact: {
        ...prediction,
        gateState: (prediction.risk === "high" || prediction.risk === "critical") ? "open" : null,
        ranAt: new Date().toISOString(),
      },
    })
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id);

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

  // Sync gate decision back to the issue's latest_pr_impact badge
  const { data: issueRow } = await svc
    .from("issues")
    .select("latest_pr_impact")
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id)
    .single();
  if (issueRow?.latest_pr_impact) {
    await svc
      .from("issues")
      .update({ latest_pr_impact: { ...issueRow.latest_pr_impact as object, gateState: decision } })
      .eq("id", issueId)
      .eq("tenant_id", ctx.tenant.id);
  }

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

export type CreatedSubIssue = { id: string; number: number; title: string; status: string; priority: string };

export async function createActionItemsFromPredictionAction(
  slug: string,
  issueId: string,
  suggestions: string[],
): Promise<{ subIssues: CreatedSubIssue[]; comment: import("@/lib/repositories/issueActivity").IssueComment }> {
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

  const { data: parentFull } = await supabase
    .from("issues")
    .select("status")
    .eq("id", issueId)
    .eq("tenant_id", ctx.tenant.id)
    .single();
  const inheritedStatus = parentFull?.status ?? "todo";

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

  const created: CreatedSubIssue[] = [];
  for (const suggestion of suggestions) {
    const { data: row } = await svc.from("issues").insert({
      tenant_id: ctx.tenant.id,
      project_id: issue.project_id,
      number: nextNumber,
      title: suggestion,
      type: "task",
      priority: "medium",
      status: inheritedStatus,
      parent_id: issueId,
    }).select("id, number, title, status, priority").single();
    if (row) created.push(row as CreatedSubIssue);
    nextNumber++;
  }

  const comment = await issueActivityRepo(svc).addComment({
    tenantId: ctx.tenant.id,
    issueId,
    authorId: null,
    authorLabel: "PR Impact",
    body: `📋 **${suggestions.length} action item${suggestions.length !== 1 ? "s" : ""} created** from PR Impact suggestions:\n\n${suggestions.map((s) => `- ${s}`).join("\n")}`,
  });

  revalidatePath(`/${slug}/issues/${issueId}`);
  revalidatePath(`/${slug}/board`);
  return { subIssues: created, comment };
}
