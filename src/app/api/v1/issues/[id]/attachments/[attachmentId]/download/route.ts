import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
// eslint-disable-next-line no-restricted-imports -- service-role: signed-URL generation for private storage bucket (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issueAttachmentsRepo } from "@/lib/repositories/issueAttachments";
import { issuesRepo } from "@/lib/repositories/issues";

export const runtime = "nodejs";

const BUCKET = "issue-attachments";

/**
 * GET /api/v1/issues/:id/attachments/:attachmentId/download
 * Redirects to a short-lived signed URL for the file — the attachments bucket
 * is private, so there's no stable public URL to hand back from the list
 * endpoint. Matches the pattern already used for the web UI's own downloads
 * (src/app/[tenant]/issues/[id]/actions.ts).
 *
 * curl example (follow the redirect to get the file):
 *   curl -L https://your-forge/api/v1/issues/<id>/attachments/<attachmentId>/download \
 *     -H "Authorization: Bearer <key>" -o downloaded-file
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const gate = await enforce(req, SCOPES.ISSUES_READ);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { id: issueId, attachmentId } = await params;

  const svc = createSupabaseServiceClient();
  const issue = await issuesRepo(svc).get(tenantId, issueId);
  if (!issue) return apiError("not_found", "Issue not found.");

  const attachment = await issueAttachmentsRepo(svc).getById(tenantId, attachmentId);
  if (!attachment || attachment.issueId !== issueId) {
    return apiError("not_found", "Attachment not found on this issue.");
  }

  const { data, error } = await svc.storage
    .from(BUCKET)
    .createSignedUrl(attachment.storagePath, 60, { download: attachment.filename });
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed", message: error?.message ?? "Could not sign URL." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
