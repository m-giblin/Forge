import type { SupabaseClient } from "@supabase/supabase-js";

export type SupportTicket = {
  id: string;
  tenant_id: string;
  submitted_by: string | null;
  actor_label: string | null;
  title: string;
  body: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  ai_triage_summary: string | null;
  ai_guidance: string | null;
  platform_notes: string | null;
  escalation_email_sent_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, tenant_id, submitted_by, actor_label, title, body, status, priority, ai_triage_summary, ai_guidance, platform_notes, escalation_email_sent_at, resolved_at, created_at, updated_at";

/**
 * Support ticket data access. Tenant-scoped queries always filter on tenant_id
 * explicitly. Super-admin queries (listAll, countOpen) operate across tenants —
 * callers must ensure the supabase client has service-role credentials.
 */
export function supportTicketsRepo(supabase: SupabaseClient) {
  return {
    async create(input: {
      tenant_id: string;
      submitted_by?: string | null;
      actor_label?: string | null;
      title: string;
      body: string;
      priority?: SupportTicket["priority"];
    }): Promise<SupportTicket> {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          tenant_id: input.tenant_id,
          submitted_by: input.submitted_by ?? null,
          actor_label: input.actor_label ?? null,
          title: input.title,
          body: input.body,
          priority: input.priority ?? "medium",
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return data as SupportTicket;
    },

    async updateTriage(
      id: string,
      patch: { ai_triage_summary: string; ai_guidance: string }
    ): Promise<void> {
      const { error } = await supabase
        .from("support_tickets")
        .update({
          ai_triage_summary: patch.ai_triage_summary,
          ai_guidance: patch.ai_guidance,
        })
        .eq("id", id);
      if (error) throw error;
    },

    async listByTenant(tenantId: string): Promise<SupportTicket[]> {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupportTicket[];
    },

    /** All tickets across tenants — for super-admin use only. */
    async listAll(): Promise<SupportTicket[]> {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(COLS)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SupportTicket[];
    },

    async updateStatus(
      id: string,
      status: SupportTicket["status"],
      platformNotes?: string
    ): Promise<void> {
      const patch: Record<string, unknown> = { status };
      if (platformNotes !== undefined) patch.platform_notes = platformNotes;
      if (status === "resolved") patch.resolved_at = new Date().toISOString();
      const { error } = await supabase
        .from("support_tickets")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },

    async markEscalated(id: string): Promise<void> {
      const { error } = await supabase
        .from("support_tickets")
        .update({ escalation_email_sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    /** Count of open tickets across all tenants. */
    async countOpen(): Promise<number> {
      const { count, error } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
  };
}
