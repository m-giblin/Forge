import type { SupabaseClient } from "@supabase/supabase-js";

export type EstimationSession = {
  id: string;
  tenant_id: string;
  project_id: string;
  created_by: string | null;
  status: "active" | "completed";
  current_issue_id: string | null;
  revealed: boolean;
  created_at: string;
};

export type EstimationVote = {
  id: string;
  session_id: string;
  issue_id: string;
  user_id: string;
  value: string;
};

const SESSION_COLS = "id, tenant_id, project_id, created_by, status, current_issue_id, revealed, created_at";
const VOTE_COLS = "id, session_id, issue_id, user_id, value";

export function estimationSessionsRepo(supabase: SupabaseClient) {
  return {
    async get(tenantId: string, id: string): Promise<EstimationSession | null> {
      const { data, error } = await supabase.from("estimation_sessions").select(SESSION_COLS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
      if (error) throw error;
      return data as EstimationSession | null;
    },

    async listActiveForProject(tenantId: string, projectId: string): Promise<EstimationSession[]> {
      const { data, error } = await supabase
        .from("estimation_sessions")
        .select(SESSION_COLS)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EstimationSession[];
    },

    async create(input: { tenant_id: string; project_id: string; created_by: string; current_issue_id: string | null }): Promise<EstimationSession> {
      const { data, error } = await supabase.from("estimation_sessions").insert(input).select(SESSION_COLS).single();
      if (error) throw error;
      return data as EstimationSession;
    },

    async update(tenantId: string, id: string, patch: Partial<Pick<EstimationSession, "current_issue_id" | "revealed" | "status">>): Promise<void> {
      const { error } = await supabase.from("estimation_sessions").update(patch).eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}

export function estimationVotesRepo(supabase: SupabaseClient) {
  return {
    async listForIssue(sessionId: string, issueId: string): Promise<EstimationVote[]> {
      const { data, error } = await supabase.from("estimation_votes").select(VOTE_COLS).eq("session_id", sessionId).eq("issue_id", issueId);
      if (error) throw error;
      return (data ?? []) as EstimationVote[];
    },

    async castVote(input: { tenant_id: string; session_id: string; issue_id: string; user_id: string; value: string }): Promise<void> {
      const { error } = await supabase.from("estimation_votes").upsert(input, { onConflict: "session_id,issue_id,user_id" });
      if (error) throw error;
    },
  };
}
