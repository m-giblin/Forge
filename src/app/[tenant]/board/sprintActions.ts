"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports -- service-role: sprint writes bypass user-JWT RLS (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sprintsRepo, type Sprint } from "@/lib/repositories/sprints";

function assertCanEdit(ctx: Parameters<typeof ctxCanDo>[0]) {
  if (!ctxCanDo(ctx, "manage_sprints")) throw new Error("You don't have permission to manage sprints.");
}

function svc() {
  return sprintsRepo(createSupabaseServiceClient());
}

export async function createSprintAction(
  slug: string,
  projectId: string,
  name: string,
  goal: string,
  startDate: string,
  endDate: string,
): Promise<Sprint> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  const sprint = await svc().create({
    tenantId: ctx.tenant.id,
    projectId,
    name: name.trim() || "Sprint",
    goal: goal.trim() || null,
    startDate: startDate || null,
    endDate: endDate || null,
  });
  revalidatePath(`/${slug}/board`);
  return sprint;
}

export async function startSprintAction(slug: string, sprintId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().update(ctx.tenant.id, sprintId, { status: "active" });
  revalidatePath(`/${slug}/board`);
}

export async function completeSprintAction(slug: string, sprintId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().update(ctx.tenant.id, sprintId, { status: "completed" });
  revalidatePath(`/${slug}/board`);
}

export async function addIssueToSprintAction(slug: string, sprintId: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().addIssue(sprintId, ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/board`);
}

export async function removeIssueFromSprintAction(slug: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().removeIssue(ctx.tenant.id, issueId);
  revalidatePath(`/${slug}/board`);
}

/** Bulk-create evenly spaced sprints from a cadence. */
export async function updateSprintAction(
  slug: string,
  sprintId: string,
  patch: { name?: string; goal?: string; startDate?: string; endDate?: string }
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  await svc().update(ctx.tenant.id, sprintId, {
    name:      patch.name?.trim()      || undefined,
    goal:      patch.goal?.trim()      ?? null,
    startDate: patch.startDate?.trim() || null,
    endDate:   patch.endDate?.trim()   || null,
  });
  revalidatePath(`/${slug}/board`);
}

export async function bulkCreateSprintsAction(
  slug: string,
  projectId: string,
  sprints: { name: string; goal: string; startDate: string; endDate: string }[]
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);
  const repo = svc();
  for (const s of sprints) {
    await repo.create({
      tenantId: ctx.tenant.id,
      projectId,
      name: s.name.trim() || "Sprint",
      goal: s.goal.trim() || null,
      startDate: s.startDate || null,
      endDate: s.endDate || null,
    });
  }
  revalidatePath(`/${slug}/board`);
}

/** Parse a plain-text sprint plan with Grok and return structured sprints. */
export async function parseSprintDocAction(
  slug: string,
  text: string
): Promise<{ name: string; goal: string; startDate: string; endDate: string }[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanEdit(ctx);

  // eslint-disable-next-line no-restricted-imports -- service-role: AI key lookup (sec09)
  const { createSupabaseServiceClient: svcClient } = await import("@/lib/supabase/service");
  const { serverEnv } = await import("@/lib/env");

  // Get tenant AI key or fall back to platform key
  const db = svcClient();
  const { data: keyRow } = await db
    .from("tenant_ai_keys")
    .select("key_enc, key_nonce, key_tag")
    .eq("tenant_id", ctx.tenant.id)
    .eq("provider", "xai")
    .eq("is_active", true)
    .maybeSingle();

  const apiKey = keyRow ? await decryptKey(keyRow) : serverEnv().GROK_API_KEY;
  if (!apiKey) throw new Error("No AI key configured. Add an xAI key in Admin → AI Settings.");

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You are a sprint planning assistant. Parse the following sprint plan document and return a JSON array of sprint objects.

Each object must have exactly these fields:
- "name": string (e.g. "Sprint 1", "Sprint 0 — Foundation")
- "goal": string (short description of sprint goal, or "" if not stated)
- "startDate": string in YYYY-MM-DD format (or "" if not specified)
- "endDate": string in YYYY-MM-DD format (or "" if not specified)

Today is ${today}. If dates are relative (e.g. "Week 1"), calculate from today.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

Document:
---
${text.slice(0, 8000)}
---`;

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-3-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "[]";

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("AI did not return an array");
    return (parsed as Record<string, string>[]).map((s) => ({
      name:      String(s.name ?? "Sprint"),
      goal:      String(s.goal ?? ""),
      startDate: String(s.startDate ?? ""),
      endDate:   String(s.endDate ?? ""),
    }));
  } catch {
    throw new Error("AI returned unreadable output. Try again or simplify the document.");
  }
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
