"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import {
  startEstimationSession, castVote, revealVotes, applyPointsAndAdvance, skipCurrentIssue, endEstimationSession,
} from "@/lib/services/estimationPoker";

function assertCanVote(role: string) {
  if (role === "viewer") throw new Error("Viewers can't participate in estimation sessions.");
}

export async function startEstimationSessionAction(slug: string, projectId: string): Promise<string> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanVote(ctx.role);
  const session = await startEstimationSession(ctx.tenant.id, projectId, ctx.appUserId);
  return session.id;
}

export async function castVoteAction(slug: string, sessionId: string, issueId: string, value: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanVote(ctx.role);
  await castVote(ctx.tenant.id, sessionId, issueId, ctx.appUserId, value);
}

export async function revealVotesAction(slug: string, sessionId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanVote(ctx.role);
  await revealVotes(ctx.tenant.id, sessionId);
}

export async function applyPointsAction(slug: string, sessionId: string, projectId: string, issueId: string, points: number) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanVote(ctx.role);
  const result = await applyPointsAndAdvance(ctx.tenant.id, sessionId, projectId, issueId, points, { userId: ctx.appUserId, label: ctx.email ?? null });
  revalidatePath(`/${slug}/board`);
  return result;
}

export async function skipIssueAction(slug: string, sessionId: string, projectId: string, issueId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanVote(ctx.role);
  return skipCurrentIssue(ctx.tenant.id, sessionId, projectId, issueId);
}

export async function endSessionAction(slug: string, sessionId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanVote(ctx.role);
  await endEstimationSession(ctx.tenant.id, sessionId);
}
