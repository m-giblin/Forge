"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: canvas writes bypass user-JWT RLS, matching mindmap/actions.ts (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ideaCanvasRepo, type IdeaCanvasNode, type IdeaCanvasNodeKind } from "@/lib/repositories/ideaCanvas";
import { ideasRepo } from "@/lib/repositories/ideas";
import { grokComplete } from "@/lib/services/grokAi";

/** Canvas brainstorming is collaborative (like comments) — any non-viewer member can add/move cards. */
function assertCanEditCanvas(ctx: { role: string }) {
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit the idea canvas.");
}

async function assertIdeaInTenant(tenantId: string, ideaId: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc.from("ideas").select("id").eq("id", ideaId).eq("tenant_id", tenantId).maybeSingle();
  if (!data) throw new Error("Idea not found in this workspace.");
}

export async function createCanvasNodeAction(
  slug: string,
  ideaId: string,
  kind: IdeaCanvasNodeKind,
  text: string,
  posX: number,
  posY: number
): Promise<IdeaCanvasNode> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEditCanvas(ctx);
  await assertIdeaInTenant(ctx.tenant.id, ideaId);

  const node = await ideaCanvasRepo(createSupabaseServiceClient()).createNode({
    tenantId: ctx.tenant.id,
    ideaId,
    kind,
    text,
    posX,
    posY,
    createdBy: ctx.appUserId,
  });
  revalidatePath(`/${slug}/think-tank/${ideaId}/canvas`);
  return node;
}

export async function updateCanvasNodeAction(
  slug: string,
  ideaId: string,
  nodeId: string,
  patch: { text?: string; posX?: number; posY?: number }
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEditCanvas(ctx);
  await assertIdeaInTenant(ctx.tenant.id, ideaId);
  await ideaCanvasRepo(createSupabaseServiceClient()).updateNode(ctx.tenant.id, nodeId, patch);
  revalidatePath(`/${slug}/think-tank/${ideaId}/canvas`);
}

export async function deleteCanvasNodeAction(slug: string, ideaId: string, nodeId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEditCanvas(ctx);
  await assertIdeaInTenant(ctx.tenant.id, ideaId);
  await ideaCanvasRepo(createSupabaseServiceClient()).deleteNode(ctx.tenant.id, nodeId);
  revalidatePath(`/${slug}/think-tank/${ideaId}/canvas`);
}

export async function createCanvasEdgeAction(
  slug: string,
  ideaId: string,
  fromNode: string,
  toNode: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEditCanvas(ctx);
  await assertIdeaInTenant(ctx.tenant.id, ideaId);
  await ideaCanvasRepo(createSupabaseServiceClient()).createEdge({
    tenantId: ctx.tenant.id,
    ideaId,
    fromNode,
    toNode,
  });
  revalidatePath(`/${slug}/think-tank/${ideaId}/canvas`);
}

export async function deleteCanvasEdgeAction(slug: string, ideaId: string, edgeId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEditCanvas(ctx);
  await assertIdeaInTenant(ctx.tenant.id, ideaId);
  await ideaCanvasRepo(createSupabaseServiceClient()).deleteEdge(ctx.tenant.id, edgeId);
  revalidatePath(`/${slug}/think-tank/${ideaId}/canvas`);
}

const KIND_LABEL: Record<IdeaCanvasNodeKind, string> = {
  problem: "PROBLEMS",
  feature: "PROPOSED FEATURES",
  risk: "KNOWN RISKS",
  question: "OPEN QUESTIONS",
  ai: "PRIOR AI SUGGESTIONS",
};

function buildPrompt(ideaTitle: string, nodes: IdeaCanvasNode[]): string {
  const section = (kind: IdeaCanvasNodeKind) => {
    const items = nodes.filter((n) => n.kind === kind).map((n) => `- ${n.text}`);
    return items.length ? items.join("\n") : "- (none yet)";
  };
  return `You are reviewing an early product idea before it becomes a project.

IDEA: ${ideaTitle}

${KIND_LABEL.problem}:
${section("problem")}

${KIND_LABEL.feature}:
${section("feature")}

${KIND_LABEL.risk}:
${section("risk")}

${KIND_LABEL.question}:
${section("question")}

Evaluate feasibility, flag anything missing, and suggest what the first sprint should scope in vs. defer. Keep it under 200 words. Format as short bullet points, one idea per line, no preamble.`;
}

/**
 * Serializes the current canvas into a prompt and asks Grok to critique it.
 * Returns the raw text — the client offers to turn each bullet into a new
 * "ai" kind node via createCanvasNodeAction, it does not persist anything
 * itself (a critique the PM doesn't like should be free to just discard).
 */
export async function testIdeaCanvasWithAiAction(slug: string, ideaId: string): Promise<string> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  await assertIdeaInTenant(ctx.tenant.id, ideaId);

  const svc = createSupabaseServiceClient();
  const [idea, nodes] = await Promise.all([
    ideasRepo(svc).getById(ctx.tenant.id, ideaId),
    ideaCanvasRepo(svc).listNodes(ctx.tenant.id, ideaId),
  ]);
  if (!idea) throw new Error("Idea not found.");
  if (nodes.length === 0) throw new Error("Add a few cards to the canvas before testing with AI.");

  return grokComplete(ctx.tenant.id, buildPrompt(idea.title, nodes), {
    feature: "idea_canvas_ai_test",
    temperature: 0.4,
    maxTokens: 500,
  });
}
