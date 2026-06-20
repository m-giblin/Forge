"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { updateIssue, deleteIssue, addIssueComment, type IssuePatch } from "@/lib/services/issues";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueAttachmentsRepo } from "@/lib/repositories/issueAttachments";

const BUCKET = "issue-attachments";
const QUOTA_BYTES = 100 * 1024 * 1024; // 100 MB / month per tenant
const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.ms-excel",
]);

export async function updateIssueAction(slug: string, id: string, patch: IssuePatch) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues.");
  const issue = await updateIssue(ctx.tenant.id, id, patch, { userId: ctx.appUserId, label: ctx.email });
  revalidatePath(`/${slug}/issues/${id}`);
  revalidatePath(`/${slug}/board`);
  return issue;
}

export async function addCommentAction(slug: string, id: string, body: string, parentId?: string | null) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot comment.");
  const comment = await addIssueComment({
    tenantId: ctx.tenant.id,
    issueId: id,
    authorId: ctx.appUserId,
    authorLabel: ctx.email,
    body,
    parentId: parentId ?? null,
  });
  revalidatePath(`/${slug}/issues/${id}`);
  return comment;
}

// ---- Attachments ----

export async function requestUploadUrlAction(
  slug: string,
  issueId: string,
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<{ attachmentId: string; signedUrl: string; token: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot upload files.");
  if (!ALLOWED_TYPES.has(contentType)) throw new Error("File type not allowed.");
  if (sizeBytes > 10 * 1024 * 1024) throw new Error("File exceeds 10 MB limit.");

  const svc = createSupabaseServiceClient();
  const repo = issueAttachmentsRepo(svc);

  // Monthly quota check
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const used = await repo.totalBytes(ctx.tenant.id, monthStart);
  if (used + sizeBytes > QUOTA_BYTES) throw new Error("Monthly storage limit (100 MB) reached.");

  const attachmentId = crypto.randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${ctx.tenant.id}/${issueId}/${attachmentId}-${safeName}`;

  // Pre-insert the metadata row so the signed URL and DB record are always in sync.
  await repo.insert({
    id: attachmentId,
    tenantId: ctx.tenant.id,
    issueId,
    filename,
    contentType,
    sizeBytes,
    storagePath,
    uploadedBy: ctx.appUserId,
  });

  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) {
    // Clean up the pre-inserted row if we can't get a signed URL.
    await svc.from("issue_attachments").delete().eq("id", attachmentId);
    throw new Error("Could not generate upload URL.");
  }

  return { attachmentId, signedUrl: data.signedUrl, token: data.token };
}

export async function getAttachmentDownloadUrlAction(
  slug: string,
  storagePath: string
): Promise<string> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!storagePath.startsWith(`${ctx.tenant.id}/`)) throw new Error("Access denied.");

  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error || !data) throw new Error("Could not generate download URL.");
  return data.signedUrl;
}

export async function deleteAttachmentAction(
  slug: string,
  attachmentId: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot delete attachments.");

  const svc = createSupabaseServiceClient();
  const storagePath = await issueAttachmentsRepo(svc).delete(ctx.tenant.id, attachmentId);
  await svc.storage.from(BUCKET).remove([storagePath]);
  revalidatePath(`/${slug}/issues`);
}

export async function deleteIssueAction(slug: string, id: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("Only owners and admins can delete issues.");
  }
  await deleteIssue(ctx.tenant.id, id);
  revalidatePath(`/${slug}/board`);
  redirect(`/${slug}/board`);
}
