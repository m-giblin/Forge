import type { SupabaseClient } from "@supabase/supabase-js";

export type RiskGateState = "open" | "approved" | "denied";
export type RiskLevel = "high" | "critical";

export interface RiskGate {
  id: string;
  tenantId: string;
  issueId: string;
  state: RiskGateState;
  riskLevel: RiskLevel;
  predictionJson: Record<string, unknown>;
  triggeredBy: string | null;
  reviewedBy: string | null;
  reviewReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface RiskGateWithIssue extends RiskGate {
  issueNumber: number;
  issueTitle: string;
  issueKey: string;
  projectKey: string;
}

function mapRow(r: Record<string, unknown>): RiskGate {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    issueId: r.issue_id as string,
    state: r.state as RiskGateState,
    riskLevel: r.risk_level as RiskLevel,
    predictionJson: (r.prediction_json ?? {}) as Record<string, unknown>,
    triggeredBy: (r.triggered_by as string) ?? null,
    reviewedBy: (r.reviewed_by as string) ?? null,
    reviewReason: (r.review_reason as string) ?? null,
    createdAt: r.created_at as string,
    reviewedAt: (r.reviewed_at as string) ?? null,
  };
}

export function issueRiskGatesRepo(svc: SupabaseClient) {
  return {
    async createGate(input: {
      tenantId: string;
      issueId: string;
      riskLevel: RiskLevel;
      predictionJson: Record<string, unknown>;
      triggeredBy: string | null;
    }): Promise<RiskGate> {
      const { data, error } = await svc
        .from("issue_risk_gates")
        .insert({
          tenant_id: input.tenantId,
          issue_id: input.issueId,
          risk_level: input.riskLevel,
          prediction_json: input.predictionJson,
          triggered_by: input.triggeredBy,
          state: "open",
        })
        .select()
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },

    async getActiveGate(tenantId: string, issueId: string): Promise<RiskGate | null> {
      const { data } = await svc
        .from("issue_risk_gates")
        .select()
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const gate = mapRow(data as Record<string, unknown>);
      return gate.state === "open" ? gate : null;
    },

    async getLatestGate(tenantId: string, issueId: string): Promise<RiskGate | null> {
      const { data } = await svc
        .from("issue_risk_gates")
        .select()
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? mapRow(data as Record<string, unknown>) : null;
    },

    async reviewGate(input: {
      gateId: string;
      tenantId: string;
      state: "approved" | "denied";
      reviewedBy: string;
      reviewReason: string;
    }): Promise<RiskGate> {
      const { data, error } = await svc
        .from("issue_risk_gates")
        .update({
          state: input.state,
          reviewed_by: input.reviewedBy,
          review_reason: input.reviewReason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.gateId)
        .eq("tenant_id", input.tenantId)
        .select()
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },

    async listOpenGates(tenantId: string): Promise<RiskGateWithIssue[]> {
      const { data } = await svc
        .from("issue_risk_gates")
        .select(`
          *,
          issues!inner(number, title, tenant_id,
            projects!inner(key)
          )
        `)
        .eq("tenant_id", tenantId)
        .eq("state", "open")
        .order("created_at", { ascending: true });

      if (!data) return [];
      return (data as Record<string, unknown>[]).map((r) => {
        const issue = r.issues as Record<string, unknown>;
        const project = issue.projects as Record<string, unknown>;
        const gate = mapRow(r);
        return {
          ...gate,
          issueNumber: issue.number as number,
          issueTitle: issue.title as string,
          issueKey: `${project.key}-${issue.number}`,
          projectKey: project.key as string,
        };
      });
    },

    async listStaleOpenGates(tenantId: string, olderThanHours: number): Promise<RiskGateWithIssue[]> {
      const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
      const { data } = await svc
        .from("issue_risk_gates")
        .select(`
          *,
          issues!inner(number, title, tenant_id,
            projects!inner(key)
          )
        `)
        .eq("tenant_id", tenantId)
        .eq("state", "open")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true });

      if (!data) return [];
      return (data as Record<string, unknown>[]).map((r) => {
        const issue = r.issues as Record<string, unknown>;
        const project = issue.projects as Record<string, unknown>;
        const gate = mapRow(r);
        return {
          ...gate,
          issueNumber: issue.number as number,
          issueTitle: issue.title as string,
          issueKey: `${project.key}-${issue.number}`,
          projectKey: project.key as string,
        };
      });
    },
  };
}
