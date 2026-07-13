import { NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
// eslint-disable-next-line no-restricted-imports -- service-role: attachment upload to Supabase Storage (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueAttachmentsRepo } from "@/lib/repositories/issueAttachments";
import { issuesRepo } from "@/lib/repositories/issues";

export const runtime = "nodejs";

const BUCKET = "issue-attachments";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const QUOTA_BYTES = 100 * 1024 * 1024; // 100 MB / month
// FORGE-71: session replay events, uploaded as a regular attachment rather than
// new storage infra. Kept a distinct content type so the UI can pull it out of
// the plain-file list and render it as its own prominent "Session Replay" card.
export const REPLAY_CONTENT_TYPE = "application/x-forge-replay+json";

const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.ms-excel",
  REPLAY_CONTENT_TYPE,
]);

/**
 * POST /api/v1/issues/:id/attachments
 * Content-Type: multipart/form-data
 * Field: file (the attachment)
 *
 * curl example:
 *   curl -X POST https://your-forge/api/v1/issues/<id>/attachments \
 *     -H "Authorization: Bearer <key>" \
 *     -F "file=@/path/to/screenshot.png"
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await enforce(req, SCOPES.ISSUES_WRITE);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { id: issueId } = await params;

  // Verify issue exists and belongs to this tenant
  const svc = createSupabaseServiceClient();
  const issue = await issuesRepo(svc).get(tenantId, issueId);
  if (!issue) return apiError("not_found", "Issue not found.");

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError("invalid_request", "Body must be multipart/form-data.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("invalid_request", 'Missing "file" field in form data.');
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return apiError("invalid_request", `File type "${file.type}" is not allowed.`);
  }
  if (file.size > MAX_BYTES) {
    return apiError("invalid_request", "File exceeds the 10 MB limit.");
  }
  if (file.size === 0) {
    return apiError("invalid_request", "File is empty.");
  }

  const repo = issueAttachmentsRepo(svc);

  // Monthly quota check
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const used = await repo.totalBytes(tenantId, monthStart);
  if (used + file.size > QUOTA_BYTES) {
    return apiError("forbidden", "Monthly storage limit (100 MB) reached.");
  }

  const attachmentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${tenantId}/${issueId}/${attachmentId}-${safeName}`;

  // Stream file to Supabase Storage
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await svc.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: "upload_failed", message: uploadError.message }, { status: 500 });
  }

  // Persist metadata
  const attachment = await repo.insert({
    id: attachmentId,
    tenantId,
    issueId,
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    storagePath,
    // API-key uploads have no associated user row — uploaded_by is nullable
    // and FKs to public.users(id), so gate.auth.keyId (an api_keys id) would
    // violate that FK. This previously 500'd on every single API upload.
    uploadedBy: null,
  });

  return apiOk(attachment, 201);
}

/**
 * GET /api/v1/issues/:id/attachments
 * Returns metadata list. Download URLs are signed — fetch each via the download endpoint.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await enforce(req, SCOPES.ISSUES_READ);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { id: issueId } = await params;

  const svc = createSupabaseServiceClient();
  const issue = await issuesRepo(svc).get(tenantId, issueId);
  if (!issue) return apiError("not_found", "Issue not found.");

  const attachments = await issueAttachmentsRepo(svc).list(tenantId, issueId);
  return apiOk(attachments);
}
