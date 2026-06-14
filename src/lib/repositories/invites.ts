import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipRole } from "@/lib/repositories/members";

export type InviteRow = {
  id: string;
  tenant_id: string;
  email: string | null;
  role: MembershipRole;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const COLS = "id, tenant_id, email, role, expires_at, accepted_at, created_at";

export function invitesRepo(supabase: SupabaseClient) {
  return {
    /** Pending (unaccepted) invites for a tenant — admin UI (RLS owner/admin). */
    async listPending(tenantId: string): Promise<InviteRow[]> {
      const { data, error } = await supabase
        .from("invites")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },

    async create(input: {
      tenant_id: string;
      email: string | null;
      role: MembershipRole;
      token_hash: string;
      created_by: string | null;
    }): Promise<InviteRow> {
      const { data, error } = await supabase.from("invites").insert(input).select(COLS).single();
      if (error) throw error;
      return data as InviteRow;
    },

    async revoke(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("invites").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },

    /** Find a usable invite by token hash (service-role; accept flow). */
    async findUsableByHash(tokenHash: string) {
      const { data, error } = await supabase
        .from("invites")
        .select("id, tenant_id, email, role, expires_at, accepted_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    /**
     * Atomically claim an invite (single-use): marks accepted only if not
     * already accepted. Returns the row if WE claimed it, null otherwise.
     */
    async claim(id: string, acceptedBy: string) {
      const { data, error } = await supabase
        .from("invites")
        .update({ accepted_at: new Date().toISOString(), accepted_by: acceptedBy })
        .eq("id", id)
        .is("accepted_at", null)
        .select("id, tenant_id, role")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}
