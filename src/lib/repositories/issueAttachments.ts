import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueAttachment = {
  id: string;
  issueId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string | null;
  createdAt: string;
};

export function issueAttachmentsRepo(supabase: SupabaseClient) {
  return {
    async list(tenantId: string, issueId: string): Promise<IssueAttachment[]> {
      const { data, error } = await supabase
        .from("issue_attachments")
        .select("id, issue_id, filename, content_type, size_bytes, storage_path, uploaded_by, created_at")
        .eq("tenant_id", tenantId)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        issueId: r.issue_id,
        filename: r.filename,
        contentType: r.content_type,
        sizeBytes: r.size_bytes,
        storagePath: r.storage_path,
        uploadedBy: r.uploaded_by,
        createdAt: r.created_at,
      }));
    },

    async insert(row: {
      id: string;
      tenantId: string;
      issueId: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      storagePath: string;
      /** null for API-key uploads — uploaded_by references public.users(id), and
       * an API key has no corresponding user row. */
      uploadedBy: string | null;
    }): Promise<IssueAttachment> {
      const { data, error } = await supabase
        .from("issue_attachments")
        .insert({
          id: row.id,
          tenant_id: row.tenantId,
          issue_id: row.issueId,
          filename: row.filename,
          content_type: row.contentType,
          size_bytes: row.sizeBytes,
          storage_path: row.storagePath,
          uploaded_by: row.uploadedBy,
        })
        .select("id, issue_id, filename, content_type, size_bytes, storage_path, uploaded_by, created_at")
        .single();
      if (error) throw error;
      return {
        id: data.id,
        issueId: data.issue_id,
        filename: data.filename,
        contentType: data.content_type,
        sizeBytes: data.size_bytes,
        storagePath: data.storage_path,
        uploadedBy: data.uploaded_by,
        createdAt: data.created_at,
      };
    },

    async delete(tenantId: string, id: string): Promise<string> {
      const { data, error } = await supabase
        .from("issue_attachments")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select("storage_path")
        .single();
      if (error) throw error;
      return data.storage_path;
    },

    async totalBytes(tenantId: string, since: Date): Promise<number> {
      const { data, error } = await supabase
        .from("issue_attachments")
        .select("size_bytes")
        .eq("tenant_id", tenantId)
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return (data ?? []).reduce((sum, r) => sum + (r.size_bytes as number), 0);
    },
  };
}
