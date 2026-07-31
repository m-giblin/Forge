"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { updateIssue, deleteIssue, addIssueComment, type IssuePatch } from "@/lib/services/issues";
import { ctxCanDo } from "@/lib/rbac";
import { canDo } from "@/lib/permissions";
// eslint-disable-next-line no-restricted-imports -- SEC-09: service-role required for watcher writes (no user RLS policy)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueAttachmentsRepo } from "@/lib/repositories/issueAttachments";
import { attachmentPinsRepo, type AttachmentPin } from "@/lib/repositories/attachmentPins";
import { issueWatchersRepo } from "@/lib/repositories/issueWatchers";
import { issueLinksRepo } from "@/lib/repositories/issueLinks";
import { issueRiskGatesRepo } from "@/lib/repositories/issueRiskGates";
import { matchesFileSignature, SIGNATURE_CHECK_BYTES } from "@/lib/services/fileSignature";
import { publicEnv, serverEnv } from "@/lib/env";

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

  // Blocking gate: if moving to a terminal status, check for open blockers.
  // Owners and admins can override by confirming; members get a hard stop here.
  if (patch.status === "done") {
    const svc = createSupabaseServiceClient();

    // Block if there is an open risk gate (High/Critical PR Impact)
    const activeGate = await issueRiskGatesRepo(svc).getActiveGate(ctx.tenant.id, id);
    if (activeGate) {
      throw new Error(
        `This issue has an open ${activeGate.riskLevel.toUpperCase()} risk gate. A project manager or admin must approve it before closing.`
      );
    }

    // Block if there are open blocker issues
    const links = await issueLinksRepo(svc).listForIssue(ctx.tenant.id, id, "");
    const openBlockers = links.filter(
      (l) => l.linkType === "blocks" && l.direction === "inbound" && l.targetStatus !== "done"
    );
    if (openBlockers.length > 0) {
      const titles = openBlockers.map((b) => b.targetTitle || b.targetKey).join(", ");
      throw new Error(`Blocked by open issue(s): ${titles}. Resolve blockers before closing.`);
    }
  }

  const issue = await updateIssue(ctx.tenant.id, id, patch, { userId: ctx.appUserId, label: ctx.email });
  revalidatePath(`/${slug}/issues/${id}`);
  revalidatePath(`/${slug}/board`);
  return issue;
}

export async function saveIssueSpecAction(slug: string, issueId: string, specMd: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues.");
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("issues").update({ spec_md: specMd || null }).eq("id", issueId).eq("tenant_id", ctx.tenant.id);
  if (error) throw error;
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function addCommentAction(
  slug: string,
  id: string,
  body: string,
  parentId?: string | null,
  commentType?: "comment" | "decision",
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!canDo(ctx.role, "viewer.comment", ctx.permissionOverrides)) throw new Error("You don't have permission to comment in this workspace.");
  // Only owners and admins may mark a comment as a Decision
  const resolvedType =
    commentType === "decision" && (ctx.role === "owner" || ctx.role === "admin")
      ? "decision"
      : "comment";
  const comment = await addIssueComment({
    tenantId: ctx.tenant.id,
    issueId: id,
    authorId: ctx.appUserId,
    authorLabel: ctx.email,
    body,
    parentId: parentId ?? null,
    commentType: resolvedType,
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
): Promise<{ attachmentId: string; signedUrl: string; token: string; storagePath: string }> {
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

  return { attachmentId, signedUrl: data.signedUrl, token: data.token, storagePath };
}

/**
 * Called by the client right after its direct-to-storage upload succeeds.
 * The upload itself (client → signed URL → Supabase Storage) never passes
 * through app code, so `requestUploadUrlAction`'s content-type check is only
 * ever validating what the client *claims* the file is — a spoofed
 * `Content-Type` or a renamed executable would sail right through it. This
 * closes that gap: read back the first few real bytes of the object we now
 * own in storage and check them against the magic number the declared type
 * should have. A mismatch deletes both the storage object and the metadata
 * row rather than leaving a lying attachment record behind.
 */
export async function confirmUploadAction(
  slug: string,
  attachmentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");

  const svc = createSupabaseServiceClient();
  const repo = issueAttachmentsRepo(svc);
  const attachment = await repo.getById(ctx.tenant.id, attachmentId);
  if (!attachment) throw new Error("Attachment not found.");

  // The storage SDK's download() doesn't expose a Range header, so this reads
  // just the first few bytes directly against the Storage REST API instead of
  // pulling the whole (up to 10MB) object down just to check its magic number.
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  const objectUrl = `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${attachment.storagePath}`;
  const res = await fetch(objectUrl, {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Range: `bytes=0-${SIGNATURE_CHECK_BYTES - 1}`,
    },
  });
  if (!res.ok) {
    // Object didn't land (e.g. the client's upload actually failed) — clean up the row.
    await repo.delete(ctx.tenant.id, attachmentId);
    return { ok: false, error: "Upload could not be verified. Please try again." };
  }

  const head = new Uint8Array(await res.arrayBuffer());
  if (!matchesFileSignature(head, attachment.contentType)) {
    await svc.storage.from(BUCKET).remove([attachment.storagePath]);
    await repo.delete(ctx.tenant.id, attachmentId);
    return { ok: false, error: "This file's content doesn't match its declared type and was rejected." };
  }

  return { ok: true };
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

// ---- Files & Proofing (pins on image attachments) ----

export async function listAttachmentPinsAction(slug: string, attachmentId: string): Promise<AttachmentPin[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  return attachmentPinsRepo(createSupabaseServiceClient()).listForAttachment(ctx.tenant.id, attachmentId);
}

export async function addAttachmentPinAction(
  slug: string, attachmentId: string, issueId: string, xPct: number, yPct: number, comment: string
): Promise<AttachmentPin> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot annotate attachments.");
  if (!comment.trim()) throw new Error("Pin needs a comment.");
  const pin = await attachmentPinsRepo(createSupabaseServiceClient()).create({
    tenantId: ctx.tenant.id, attachmentId, issueId, xPct, yPct, comment: comment.trim(), createdBy: ctx.appUserId,
  });
  revalidatePath(`/${slug}/issues/${issueId}`);
  return pin;
}

export async function setAttachmentPinResolvedAction(slug: string, issueId: string, pinId: string, resolved: boolean): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot resolve pins.");
  await attachmentPinsRepo(createSupabaseServiceClient()).setResolved(ctx.tenant.id, pinId, resolved, ctx.appUserId);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function deleteAttachmentPinAction(slug: string, issueId: string, pinId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot delete pins.");
  await attachmentPinsRepo(createSupabaseServiceClient()).remove(ctx.tenant.id, pinId);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function watchIssueAction(slug: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  await issueWatchersRepo(createSupabaseServiceClient()).watch(ctx.tenant.id, issueId, ctx.appUserId);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function unwatchIssueAction(slug: string, issueId: string): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  await issueWatchersRepo(createSupabaseServiceClient()).unwatch(ctx.tenant.id, issueId, ctx.appUserId);
  revalidatePath(`/${slug}/issues/${issueId}`);
}

export async function deleteIssueAction(slug: string, id: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!ctxCanDo(ctx, "delete_issues")) {
    throw new Error("You don't have permission to delete issues in this workspace.");
  }
  await deleteIssue(ctx.tenant.id, id);
  revalidatePath(`/${slug}/board`);
  redirect(`/${slug}/board`);
}

export async function markDuplicateAction(
  slug: string,
  duplicateIssueId: string,  // the issue we're closing as duplicate
  canonicalIssueId: string,  // the original issue it duplicates
  canonicalKey: string,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot merge issues.");
  const svc = createSupabaseServiceClient();

  // 1. Create duplicate link
  await svc.from("issue_links").insert({
    tenant_id: ctx.tenant.id,
    source_issue_id: duplicateIssueId,
    target_issue_id: canonicalIssueId,
    link_type: "duplicates",
  });

  // 2. Transfer comments from duplicate → canonical (with attribution header)
  const { data: dupComments } = await svc
    .from("issue_comments")
    .select("id, body, author_id, author_label, created_at")
    .eq("tenant_id", ctx.tenant.id)
    .eq("issue_id", duplicateIssueId)
    .is("parent_id", null)
    .order("created_at", { ascending: true });

  if (dupComments && dupComments.length > 0) {
    const mergedRows = dupComments.map((c) => ({
      tenant_id: ctx.tenant.id,
      issue_id: canonicalIssueId,
      author_id: c.author_id,
      author_label: c.author_label,
      body: `*[Merged from duplicate — original comment]*\n\n${c.body}`,
      parent_id: null,
    }));
    await svc.from("issue_comments").insert(mergedRows);
  }

  // 3. Transfer watchers from duplicate → canonical (ignore conflicts)
  const { data: dupWatchers } = await svc
    .from("issue_watchers")
    .select("user_id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("issue_id", duplicateIssueId);

  if (dupWatchers && dupWatchers.length > 0) {
    const watcherRows = dupWatchers.map((w) => ({
      tenant_id: ctx.tenant.id,
      issue_id: canonicalIssueId,
      user_id: w.user_id,
    }));
    await svc
      .from("issue_watchers")
      .upsert(watcherRows, { onConflict: "tenant_id,issue_id,user_id", ignoreDuplicates: true });
  }

  // 4. Close the duplicate with a won't-fix-style status
  await svc.from("issues").update({ status: "done" })
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", duplicateIssueId);

  // 5. Post timeline comment on duplicate
  await svc.from("issue_comments").insert({
    tenant_id: ctx.tenant.id,
    issue_id: duplicateIssueId,
    author_id: ctx.appUserId,
    author_label: null,
    body: `Marked as duplicate of **[${canonicalKey}](/${slug}/issues/${canonicalIssueId})** and closed. ${dupComments?.length ? `${dupComments.length} comment(s) merged into the canonical issue.` : ""}`,
    parent_id: null,
  });

  // 6. Post notice on canonical issue
  await svc.from("issue_comments").insert({
    tenant_id: ctx.tenant.id,
    issue_id: canonicalIssueId,
    author_id: ctx.appUserId,
    author_label: null,
    body: `A duplicate issue was merged into this one. ${dupComments?.length ? `${dupComments.length} comment(s) transferred.` : ""}`,
    parent_id: null,
  });

  revalidatePath(`/${slug}/issues/${duplicateIssueId}`);
  revalidatePath(`/${slug}/issues/${canonicalIssueId}`);
}

export async function cascadeStatusToChildrenAction(
  slug: string,
  parentIssueId: string,
  newStatus: string,
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers cannot edit issues.");
  const svc = createSupabaseServiceClient();
  await svc.from("issues")
    .update({ status: newStatus })
    .eq("tenant_id", ctx.tenant.id)
    .eq("parent_id", parentIssueId);
  revalidatePath(`/${slug}/issues/${parentIssueId}`);
  revalidatePath(`/${slug}/board`);
}
