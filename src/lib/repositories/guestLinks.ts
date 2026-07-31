import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectGuestLink = {
  id: string;
  tenant_id: string;
  project_id: string;
  token_hash: string;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
};

const COLS = "id, tenant_id, project_id, token_hash, is_active, revoked_at, created_at";

/** Per-project unauthenticated guest links (Board/Roadmap, view-only). Admin UI uses the tenant-RLS client; the public resolver uses the service client. */
export function guestLinksRepo(supabase: SupabaseClient) {
  return {
    async get(tenantId: string, projectId: string): Promise<ProjectGuestLink | null> {
      const { data, error } = await supabase
        .from("project_guest_links")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as ProjectGuestLink | null;
    },

    async listForTenant(tenantId: string): Promise<ProjectGuestLink[]> {
      const { data, error } = await supabase
        .from("project_guest_links")
        .select(COLS)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return (data ?? []) as ProjectGuestLink[];
    },

    /** Create or replace this project's link (one row per project) with a fresh token, active. */
    async upsert(tenantId: string, projectId: string, tokenHash: string, createdBy: string | null): Promise<void> {
      const { error } = await supabase
        .from("project_guest_links")
        .upsert(
          { tenant_id: tenantId, project_id: projectId, token_hash: tokenHash, created_by: createdBy, is_active: true, revoked_at: null },
          { onConflict: "project_id" }
        );
      if (error) throw error;
    },

    async revoke(tenantId: string, projectId: string): Promise<void> {
      const { error } = await supabase
        .from("project_guest_links")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId);
      if (error) throw error;
    },

    /** Public resolver — service-role only, looked up purely by the hashed token (never trust any client-supplied tenant/project id). */
    async resolveByTokenHash(tokenHash: string): Promise<ProjectGuestLink | null> {
      const { data, error } = await supabase
        .from("project_guest_links")
        .select(COLS)
        .eq("token_hash", tokenHash)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as ProjectGuestLink | null;
    },
  };
}
