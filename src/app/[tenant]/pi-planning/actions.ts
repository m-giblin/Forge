"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import {
  createPiCycle, setPiCycleStatus, deletePiCycle,
  addPiObjective, deletePiObjective, castPiVote,
} from "@/lib/services/piPlanning";

function assertCanParticipate(role: string) {
  if (role === "viewer") throw new Error("Viewers can't participate in PI Planning.");
}

export async function createPiCycleAction(slug: string, name: string, startDate: string, endDate: string): Promise<string> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanParticipate(ctx.role);
  const cycle = await createPiCycle(ctx.tenant.id, ctx.appUserId, name, startDate, endDate);
  revalidatePath(`/${slug}/pi-planning`);
  return cycle.id;
}

export async function setPiCycleStatusAction(slug: string, piId: string, status: "planning" | "active" | "completed") {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanParticipate(ctx.role);
  await setPiCycleStatus(ctx.tenant.id, piId, status);
  revalidatePath(`/${slug}/pi-planning`);
}

export async function deletePiCycleAction(slug: string, piId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanParticipate(ctx.role);
  await deletePiCycle(ctx.tenant.id, piId);
  revalidatePath(`/${slug}/pi-planning`);
}

export async function addPiObjectiveAction(slug: string, piId: string, title: string, description: string, projectId: string | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanParticipate(ctx.role);
  const objective = await addPiObjective(ctx.tenant.id, piId, ctx.appUserId, title, description, projectId);
  revalidatePath(`/${slug}/pi-planning/${piId}`);
  return objective;
}

export async function deletePiObjectiveAction(slug: string, piId: string, objectiveId: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanParticipate(ctx.role);
  await deletePiObjective(ctx.tenant.id, objectiveId);
  revalidatePath(`/${slug}/pi-planning/${piId}`);
}

export async function castPiVoteAction(slug: string, piId: string, objectiveId: string, score: number) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  assertCanParticipate(ctx.role);
  await castPiVote(ctx.tenant.id, objectiveId, ctx.appUserId, score);
  revalidatePath(`/${slug}/pi-planning/${piId}`);
}
