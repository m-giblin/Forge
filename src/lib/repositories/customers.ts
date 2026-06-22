import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomerAccount {
  id: string;
  tenant_id: string;
  name: string;
  domain: string | null;
  tier: string | null;
  arr_usd: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerIssueLink {
  id: string;
  tenant_id: string;
  issue_id: string;
  customer_account_id: string;
  affected_count: number | null;
  created_at: string;
}

export function customersRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string): Promise<CustomerAccount[]> {
      const { data, error } = await supabase
        .from("customer_accounts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },

    async getById(tenantId: string, id: string): Promise<CustomerAccount | null> {
      const { data } = await supabase
        .from("customer_accounts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle();
      return data ?? null;
    },

    async create(tenantId: string, input: { name: string; domain?: string | null; tier?: string | null; arr_usd?: number | null; notes?: string | null }): Promise<CustomerAccount> {
      const { data, error } = await supabase
        .from("customer_accounts")
        .insert({ tenant_id: tenantId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(tenantId: string, id: string, patch: Partial<Pick<CustomerAccount, "name" | "domain" | "tier" | "arr_usd" | "notes">>): Promise<CustomerAccount> {
      const { data, error } = await supabase
        .from("customer_accounts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(tenantId: string, id: string): Promise<void> {
      const { error } = await supabase
        .from("customer_accounts")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (error) throw error;
    },

    async listLinksForIssue(tenantId: string, issueId: string): Promise<Array<CustomerIssueLink & { customer: CustomerAccount }>> {
      const { data, error } = await supabase
        .from("customer_issue_links")
        .select("*, customer:customer_accounts(*)")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId);
      if (error) throw error;
      return (data ?? []) as Array<CustomerIssueLink & { customer: CustomerAccount }>;
    },

    async listLinksForCustomer(tenantId: string, customerId: string): Promise<CustomerIssueLink[]> {
      const { data, error } = await supabase
        .from("customer_issue_links")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("customer_account_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async linkIssue(tenantId: string, issueId: string, customerId: string, affectedCount?: number | null): Promise<CustomerIssueLink> {
      const { data, error } = await supabase
        .from("customer_issue_links")
        .upsert({ tenant_id: tenantId, issue_id: issueId, customer_account_id: customerId, affected_count: affectedCount ?? null }, { onConflict: "issue_id,customer_account_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async unlinkIssue(tenantId: string, issueId: string, customerId: string): Promise<void> {
      const { error } = await supabase
        .from("customer_issue_links")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .eq("customer_account_id", customerId);
      if (error) throw error;
    },
  };
}
