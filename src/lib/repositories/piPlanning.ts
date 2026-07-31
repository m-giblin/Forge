import type { SupabaseClient } from "@supabase/supabase-js";

export type PiCycle = {
  id: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "planning" | "active" | "completed";
  createdAt: string;
};

export type PiObjective = {
  id: string;
  piId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  position: number;
};

export type PiVote = {
  id: string;
  objectiveId: string;
  userId: string;
  score: number;
};

function cycleFromRow(r: Record<string, unknown>): PiCycle {
  return {
    id: r.id as string, tenantId: r.tenant_id as string, name: r.name as string,
    startDate: r.start_date as string, endDate: r.end_date as string,
    status: r.status as PiCycle["status"], createdAt: r.created_at as string,
  };
}

function objectiveFromRow(r: Record<string, unknown>): PiObjective {
  return {
    id: r.id as string, piId: r.pi_id as string, projectId: r.project_id as string | null,
    title: r.title as string, description: r.description as string | null, position: r.position as number,
  };
}

function voteFromRow(r: Record<string, unknown>): PiVote {
  return {
    id: r.id as string, objectiveId: r.objective_id as string,
    userId: r.user_id as string, score: r.score as number,
  };
}

export function piCyclesRepo(supabase: SupabaseClient) {
  return {
    async listForTenant(tenantId: string): Promise<PiCycle[]> {
      const { data, error } = await supabase.from("pi_cycles").select("id, tenant_id, name, start_date, end_date, status, created_at").eq("tenant_id", tenantId).order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(cycleFromRow);
    },
    async get(tenantId: string, id: string): Promise<PiCycle | null> {
      const { data, error } = await supabase.from("pi_cycles").select("id, tenant_id, name, start_date, end_date, status, created_at").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? cycleFromRow(data) : null;
    },
    async create(input: { tenantId: string; name: string; startDate: string; endDate: string; createdBy: string }): Promise<PiCycle> {
      const { data, error } = await supabase.from("pi_cycles").insert({
        tenant_id: input.tenantId, name: input.name, start_date: input.startDate, end_date: input.endDate, created_by: input.createdBy,
      }).select("id, tenant_id, name, start_date, end_date, status, created_at").single();
      if (error) throw error;
      return cycleFromRow(data);
    },
    async setStatus(tenantId: string, id: string, status: PiCycle["status"]): Promise<void> {
      const { error } = await supabase.from("pi_cycles").update({ status }).eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
    async remove(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("pi_cycles").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}

export function piObjectivesRepo(supabase: SupabaseClient) {
  return {
    async listForPi(piId: string): Promise<PiObjective[]> {
      const { data, error } = await supabase.from("pi_objectives").select("id, pi_id, project_id, title, description, position").eq("pi_id", piId).order("position");
      if (error) throw error;
      return (data ?? []).map(objectiveFromRow);
    },
    async create(input: { tenantId: string; piId: string; projectId: string | null; title: string; description: string | null; position: number; createdBy: string }): Promise<PiObjective> {
      const { data, error } = await supabase.from("pi_objectives").insert({
        tenant_id: input.tenantId, pi_id: input.piId, project_id: input.projectId, title: input.title, description: input.description, position: input.position, created_by: input.createdBy,
      }).select("id, pi_id, project_id, title, description, position").single();
      if (error) throw error;
      return objectiveFromRow(data);
    },
    async remove(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("pi_objectives").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}

export function piVotesRepo(supabase: SupabaseClient) {
  return {
    async listForPi(tenantId: string, objectiveIds: string[]): Promise<PiVote[]> {
      if (objectiveIds.length === 0) return [];
      const { data, error } = await supabase.from("pi_confidence_votes").select("id, objective_id, user_id, score").eq("tenant_id", tenantId).in("objective_id", objectiveIds);
      if (error) throw error;
      return (data ?? []).map(voteFromRow);
    },
    async castVote(input: { tenantId: string; objectiveId: string; userId: string; score: number }): Promise<void> {
      const { error } = await supabase.from("pi_confidence_votes").upsert(
        { tenant_id: input.tenantId, objective_id: input.objectiveId, user_id: input.userId, score: input.score },
        { onConflict: "objective_id,user_id" }
      );
      if (error) throw error;
    },
  };
}
