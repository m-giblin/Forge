import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  piCyclesRepo, piObjectivesRepo, piVotesRepo,
  type PiCycle, type PiObjective, type PiVote,
} from "@/lib/repositories/piPlanning";

export async function listPiCycles(tenantId: string): Promise<PiCycle[]> {
  const supabase = await createSupabaseServerClient();
  return piCyclesRepo(supabase).listForTenant(tenantId);
}

export async function getPiCycle(tenantId: string, id: string): Promise<PiCycle | null> {
  const supabase = await createSupabaseServerClient();
  return piCyclesRepo(supabase).get(tenantId, id);
}

export async function createPiCycle(tenantId: string, userId: string, name: string, startDate: string, endDate: string): Promise<PiCycle> {
  if (!name.trim()) throw new Error("Name is required.");
  if (new Date(endDate) < new Date(startDate)) throw new Error("End date must be after start date.");
  const supabase = await createSupabaseServerClient();
  return piCyclesRepo(supabase).create({ tenantId, name: name.trim(), startDate, endDate, createdBy: userId });
}

export async function setPiCycleStatus(tenantId: string, id: string, status: PiCycle["status"]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await piCyclesRepo(supabase).setStatus(tenantId, id, status);
}

export async function deletePiCycle(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await piCyclesRepo(supabase).remove(tenantId, id);
}

export async function listPiObjectives(piId: string): Promise<PiObjective[]> {
  const supabase = await createSupabaseServerClient();
  return piObjectivesRepo(supabase).listForPi(piId);
}

export async function listPiVotes(tenantId: string, objectiveIds: string[]): Promise<PiVote[]> {
  const supabase = await createSupabaseServerClient();
  return piVotesRepo(supabase).listForPi(tenantId, objectiveIds);
}

export async function addPiObjective(
  tenantId: string, piId: string, userId: string, title: string, description: string, projectId: string | null
): Promise<PiObjective> {
  if (!title.trim()) throw new Error("Title is required.");
  const supabase = await createSupabaseServerClient();
  const repo = piObjectivesRepo(supabase);
  const existing = await repo.listForPi(piId);
  return repo.create({ tenantId, piId, projectId, title: title.trim(), description: description.trim() || null, position: existing.length, createdBy: userId });
}

export async function deletePiObjective(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await piObjectivesRepo(supabase).remove(tenantId, id);
}

export async function castPiVote(tenantId: string, objectiveId: string, userId: string, score: number): Promise<void> {
  if (score < 1 || score > 5) throw new Error("Confidence score must be 1-5.");
  const supabase = await createSupabaseServerClient();
  await piVotesRepo(supabase).castVote({ tenantId, objectiveId, userId, score });
}
