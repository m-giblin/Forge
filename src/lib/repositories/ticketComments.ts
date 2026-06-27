import type { SupabaseClient } from "@supabase/supabase-js";

export type TicketComment = {
  id: string;
  ticket_id: string;
  tenant_id: string;
  author_id: string | null;
  author_label: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

const COLS = "id, ticket_id, tenant_id, author_id, author_label, body, is_internal, created_at";

export function ticketCommentsRepo(supabase: SupabaseClient) {
  return {
    async listByTicket(ticketId: string, includeInternal = true): Promise<TicketComment[]> {
      let q = supabase
        .from("ticket_comments")
        .select(COLS)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (!includeInternal) q = q.eq("is_internal", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TicketComment[];
    },

    async create(input: {
      ticket_id: string;
      tenant_id: string;
      author_id?: string | null;
      author_label?: string | null;
      body: string;
      is_internal?: boolean;
    }): Promise<TicketComment> {
      const { data, error } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: input.ticket_id,
          tenant_id: input.tenant_id,
          author_id: input.author_id ?? null,
          author_label: input.author_label ?? null,
          body: input.body,
          is_internal: input.is_internal ?? false,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return data as TicketComment;
    },
  };
}
