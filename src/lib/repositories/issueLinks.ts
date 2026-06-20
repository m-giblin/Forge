import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkType = "blocks" | "relates_to" | "duplicates";

export type IssueLink = {
  id: string;
  tenantId: string;
  sourceIssueId: string;
  targetIssueId: string;
  linkType: LinkType;
  createdAt: string;
};

export type IssueLinkWithKey = IssueLink & {
  targetKey: string;
  targetTitle: string;
  targetStatus: string;
  direction: "outbound" | "inbound";
};

function mapRow(r: Record<string, unknown>): IssueLink {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    sourceIssueId: r.source_issue_id as string,
    targetIssueId: r.target_issue_id as string,
    linkType: r.link_type as LinkType,
    createdAt: r.created_at as string,
  };
}

export function issueLinksRepo(supabase: SupabaseClient) {
  return {
    /** All links where issueId is source or target, enriched with the other issue's key+title. */
    async listForIssue(tenantId: string, issueId: string, projectKey: string): Promise<IssueLinkWithKey[]> {
      const [outbound, inbound] = await Promise.all([
        supabase
          .from("issue_links")
          .select("id, tenant_id, source_issue_id, target_issue_id, link_type, created_at, target:issues!target_issue_id(number, title, status)")
          .eq("tenant_id", tenantId)
          .eq("source_issue_id", issueId),
        supabase
          .from("issue_links")
          .select("id, tenant_id, source_issue_id, target_issue_id, link_type, created_at, source:issues!source_issue_id(number, title, status)")
          .eq("tenant_id", tenantId)
          .eq("target_issue_id", issueId),
      ]);
      if (outbound.error) throw outbound.error;
      if (inbound.error) throw inbound.error;

      const out: IssueLinkWithKey[] = (outbound.data ?? []).map((r) => {
        const t = (r as Record<string, unknown>).target as Record<string, unknown> | null;
        return {
          ...mapRow(r as Record<string, unknown>),
          targetKey: `${projectKey}-${t?.number ?? "?"}`,
          targetTitle: (t?.title as string) ?? "",
          targetStatus: (t?.status as string) ?? "",
          direction: "outbound",
        };
      });

      const inv: IssueLinkWithKey[] = (inbound.data ?? []).map((r) => {
        const s = (r as Record<string, unknown>).source as Record<string, unknown> | null;
        return {
          id: r.id as string,
          tenantId: r.tenant_id as string,
          sourceIssueId: r.source_issue_id as string,
          targetIssueId: r.target_issue_id as string,
          linkType: r.link_type as LinkType,
          createdAt: r.created_at as string,
          targetKey: `${projectKey}-${s?.number ?? "?"}`,
          targetTitle: (s?.title as string) ?? "",
          targetStatus: (s?.status as string) ?? "",
          direction: "inbound",
        };
      });

      return [...out, ...inv];
    },

    async create(tenantId: string, sourceId: string, targetId: string, linkType: LinkType): Promise<void> {
      const { error } = await supabase
        .from("issue_links")
        .insert({ tenant_id: tenantId, source_issue_id: sourceId, target_issue_id: targetId, link_type: linkType });
      if (error) throw error;
    },

    async delete(tenantId: string, linkId: string): Promise<void> {
      const { error } = await supabase
        .from("issue_links")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", linkId);
      if (error) throw error;
    },

    /** Sub-issues: children of a parent issue. */
    async listChildren(tenantId: string, parentId: string): Promise<{ id: string; number: number; title: string; status: string; priority: string }[]> {
      const { data, error } = await supabase
        .from("issues")
        .select("id, number, title, status, priority")
        .eq("tenant_id", tenantId)
        .eq("parent_id", parentId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as { id: string; number: number; title: string; status: string; priority: string }[];
    },
  };
}
