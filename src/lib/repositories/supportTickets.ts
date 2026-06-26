import type { SupabaseClient } from "@supabase/supabase-js";

export type TicketAttachment = {
  name: string;
  type: string;
  size: number;
  data: string; // base64 data URL
};

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
  attachments: TicketAttachment[];
  escalation_email_sent_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

// attachments column added in migration 0056 — selected separately so queries don't fail pre-migration
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
      attachments?: TicketAttachment[];
    }): Promise<SupportTicket> {
      const row: Record<string, unknown> = {
        tenant_id: input.tenant_id,
        submitted_by: input.submitted_by ?? null,
        actor_label: input.actor_label ?? null,
        title: input.title,
        body: input.body,
        priority: input.priority ?? "medium",
      };
      // attachments column exists after migration 0056 — only include when non-empty to avoid pre-migration errors
      if (input.attachments?.length) row.attachments = input.attachments;
      const { data, error } = await supabase
        .from("support_tickets")
        .insert(row)
        .select(COLS)
        .single();
      if (error) throw error;
      return data as SupportTicket;
    },

    async updateTriage(
      tenantId: string,
      id: string,
      patch: { ai_triage_summary: string; ai_guidance: string }
    ): Promise<void> {
      const { error } = await supabase
        .from("support_tickets")
        .update({
          ai_triage_summary: patch.ai_triage_summary,
          ai_guidance: patch.ai_guidance,
        })
        .eq("tenant_id", tenantId)
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
      tenantId: string,
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
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async markEscalated(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("support_tickets")
        .update({ escalation_email_sent_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
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
