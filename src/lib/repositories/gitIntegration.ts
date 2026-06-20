import type { SupabaseClient } from "@supabase/supabase-js";

export type GitConnection = {
  id: string;
  tenantId: string;
  provider: "github";
  installationId: string;
  accountLogin: string | null;
  status: "active" | "revoked";
  createdAt: string;
};

export type GitRepoLink = {
  id: string;
  tenantId: string;
  connectionId: string;
  repoFullName: string;
  projectId: string | null;
};

export type IssueCodeLink = {
  id: string;
  tenantId: string;
  issueId: string;
  connectionId: string;
  repoFullName: string;
  prNumber: number;
  linkKind: string;
  prState: string | null;
  prTitle: string | null;
  prUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export function gitIntegrationRepo(supabase: SupabaseClient) {
  return {
    async getConnection(tenantId: string): Promise<GitConnection | null> {
      const { data } = await supabase
        .from("git_connections")
        .select("id, tenant_id, provider, installation_id, account_login, status, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        tenantId: data.tenant_id,
        provider: data.provider,
        installationId: data.installation_id,
        accountLogin: data.account_login,
        status: data.status,
        createdAt: data.created_at,
      };
    },

    async createConnection(tenantId: string, webhookSecret: string): Promise<GitConnection> {
      const { data, error } = await supabase
        .from("git_connections")
        .insert({
          tenant_id: tenantId,
          provider: "github",
          installation_id: tenantId, // use tenantId as stable identifier for simple webhook model
          account_login: null,
          webhook_secret_enc: webhookSecret, // stored plaintext for simple model (not GitHub App)
          status: "active",
        })
        .select("id, tenant_id, provider, installation_id, account_login, status, created_at")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        tenantId: data.tenant_id,
        provider: data.provider,
        installationId: data.installation_id,
        accountLogin: data.account_login,
        status: data.status,
        createdAt: data.created_at,
      };
    },

    async getWebhookSecret(connectionId: string): Promise<string | null> {
      const { data } = await supabase
        .from("git_connections")
        .select("webhook_secret_enc")
        .eq("id", connectionId)
        .maybeSingle();
      return (data?.webhook_secret_enc as string) ?? null;
    },

    async revokeConnection(tenantId: string, connectionId: string): Promise<void> {
      await supabase
        .from("git_connections")
        .update({ status: "revoked" })
        .eq("tenant_id", tenantId)
        .eq("id", connectionId);
    },

    async listRepoLinks(tenantId: string): Promise<GitRepoLink[]> {
      const { data } = await supabase
        .from("git_repo_links")
        .select("id, tenant_id, connection_id, repo_full_name, project_id")
        .eq("tenant_id", tenantId);
      return (data ?? []).map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        connectionId: r.connection_id,
        repoFullName: r.repo_full_name,
        projectId: r.project_id,
      }));
    },

    async addRepoLink(tenantId: string, connectionId: string, repoFullName: string, projectId: string | null): Promise<GitRepoLink> {
      const { data, error } = await supabase
        .from("git_repo_links")
        .upsert({ tenant_id: tenantId, connection_id: connectionId, repo_full_name: repoFullName, project_id: projectId }, { onConflict: "tenant_id,repo_full_name" })
        .select("id, tenant_id, connection_id, repo_full_name, project_id")
        .single();
      if (error) throw error;
      return { id: data.id, tenantId: data.tenant_id, connectionId: data.connection_id, repoFullName: data.repo_full_name, projectId: data.project_id };
    },

    async removeRepoLink(tenantId: string, id: string): Promise<void> {
      await supabase.from("git_repo_links").delete().eq("tenant_id", tenantId).eq("id", id);
    },

    async getConnectionByInstallation(installationId: string): Promise<(GitConnection & { webhookSecret: string | null }) | null> {
      const { data } = await supabase
        .from("git_connections")
        .select("id, tenant_id, provider, installation_id, account_login, status, created_at, webhook_secret_enc")
        .eq("installation_id", installationId)
        .eq("status", "active")
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        tenantId: data.tenant_id,
        provider: data.provider,
        installationId: data.installation_id,
        accountLogin: data.account_login,
        status: data.status,
        createdAt: data.created_at,
        webhookSecret: data.webhook_secret_enc as string | null,
      };
    },

    async upsertCodeLink(tenantId: string, link: Omit<IssueCodeLink, "id" | "createdAt" | "updatedAt">): Promise<void> {
      await supabase.from("issue_code_links").upsert({
        tenant_id: link.tenantId,
        issue_id: link.issueId,
        connection_id: link.connectionId,
        repo_full_name: link.repoFullName,
        pr_number: link.prNumber,
        link_kind: link.linkKind,
        pr_state: link.prState,
        pr_title: link.prTitle,
        pr_url: link.prUrl,
      }, { onConflict: "tenant_id,issue_id,repo_full_name,pr_number" });
    },

    async listCodeLinks(tenantId: string, issueId: string): Promise<IssueCodeLink[]> {
      const { data } = await supabase
        .from("issue_code_links")
        .select("id, tenant_id, issue_id, connection_id, repo_full_name, pr_number, link_kind, pr_state, pr_title, pr_url, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at");
      return (data ?? []).map((r) => ({
        id: r.id, tenantId: r.tenant_id, issueId: r.issue_id, connectionId: r.connection_id,
        repoFullName: r.repo_full_name, prNumber: r.pr_number, linkKind: r.link_kind,
        prState: r.pr_state, prTitle: r.pr_title, prUrl: r.pr_url,
        createdAt: r.created_at, updatedAt: r.updated_at,
      }));
    },

    async insertCodeEvent(event: {
      tenantId: string; connectionId: string; repoFullName: string;
      kind: string; externalId: string; prNumber: number | null; sha: string | null;
      branch: string | null; actorLogin: string | null; occurredAt: string; payload: object;
    }): Promise<void> {
      await supabase.from("code_events").upsert({
        tenant_id: event.tenantId,
        connection_id: event.connectionId,
        repo_full_name: event.repoFullName,
        kind: event.kind,
        external_id: event.externalId,
        pr_number: event.prNumber,
        sha: event.sha,
        branch: event.branch,
        actor_login: event.actorLogin,
        occurred_at: event.occurredAt,
        payload: event.payload,
      }, { onConflict: "connection_id,kind,external_id" });
    },
  };
}
