import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueTemplate = {
  id: string;
  name: string;
  title_prefix: string;
  type: string;
  priority: string;
  position: number;
};

const COLS = "id, name, title_prefix, type, priority, position";

/** Per-tenant quick-create issue templates. Tenant-scoped; RLS guards writes (owner/admin). */
export function issueTemplatesRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<IssueTemplate[]> {
      const { data, error } = await supabase
        .from("tenant_issue_templates")
        .select(COLS)
        .eq("tenant_id", tenantId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as IssueTemplate[];
    },

    async add(input: {
      tenant_id: string; name: string; title_prefix: string; type: string; priority: string; position: number;
    }): Promise<IssueTemplate> {
      const { data, error } = await supabase
        .from("tenant_issue_templates")
        .insert({ ...input })
        .select(COLS)
        .single();
      if (error) throw error;
      return data as IssueTemplate;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase.from("tenant_issue_templates").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) throw error;
    },
  };
}
