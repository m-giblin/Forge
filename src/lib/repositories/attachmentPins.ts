import type { SupabaseClient } from "@supabase/supabase-js";

export type AttachmentPin = {
  id: string;
  attachmentId: string;
  issueId: string;
  xPct: number;
  yPct: number;
  number: number;
  comment: string;
  resolved: boolean;
  createdBy: string | null;
  createdAt: string;
};

const COLS = "id, attachment_id, issue_id, x_pct, y_pct, number, comment, resolved, created_by, created_at";

function fromRow(r: Record<string, unknown>): AttachmentPin {
  return {
    id: r.id as string,
    attachmentId: r.attachment_id as string,
    issueId: r.issue_id as string,
    xPct: r.x_pct as number,
    yPct: r.y_pct as number,
    number: r.number as number,
    comment: r.comment as string,
    resolved: r.resolved as boolean,
    createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
  };
}

export function attachmentPinsRepo(supabase: SupabaseClient) {
  return {
    async listForAttachment(tenantId: string, attachmentId: string): Promise<AttachmentPin[]> {
      const { data, error } = await supabase
        .from("attachment_pins")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("attachment_id", attachmentId)
        .order("number");
      if (error) throw error;
      return (data ?? []).map(fromRow);
    },

    async create(input: { tenantId: string; attachmentId: string; issueId: string; xPct: number; yPct: number; comment: string; createdBy: string }): Promise<AttachmentPin> {
      const { data: existing, error: countErr } = await supabase
        .from("attachment_pins")
        .select("number")
        .eq("tenant_id", input.tenantId)
        .eq("attachment_id", input.attachmentId)
        .order("number", { ascending: false })
        .limit(1);
      if (countErr) throw countErr;
      const nextNumber = ((existing?.[0]?.number as number | undefined) ?? 0) + 1;

      const { data, error } = await supabase
        .from("attachment_pins")
        .insert({
          tenant_id: input.tenantId, attachment_id: input.attachmentId, issue_id: input.issueId,
          x_pct: input.xPct, y_pct: input.yPct, number: nextNumber, comment: input.comment, created_by: input.createdBy,
        })
        .select(COLS)
        .single();
      if (error) throw error;
      return fromRow(data);
    },

    async setResolved(tenantId: string, id: string, resolved: boolean, userId: string): Promise<void> {
      const { error } = await supabase
        .from("attachment_pins")
        .update(resolved ? { resolved: true, resolved_at: new Date().toISOString(), resolved_by: userId } : { resolved: false, resolved_at: null, resolved_by: null })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async remove(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("attachment_pins").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}
