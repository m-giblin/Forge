import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo } from "@/lib/repositories/issues";
import { issueActivityRepo } from "@/lib/repositories/issueActivity";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const commentSchema = z.object({
  body: z.string().min(1).max(10_000),
  // Strip any HTML tags before storing — author_label is rendered in the UI
  author_label: z.string().max(200).optional().transform((v) => v?.replace(/<[^>]*>/g, "").trim() || undefined),
});

/** POST /api/v1/issues/{id}/comments — add a comment (scope: issues:write). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_WRITE);
    if (gate.error) return gate.error;
    const { id } = await params;
    const { tenantId } = gate.auth;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("invalid_request", "Body must be valid JSON.");
    }
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid_request", "Validation failed.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    const supabase = createSupabaseServiceClient();

    const issue = await issuesRepo(supabase).get(tenantId, id);
    if (!issue) return apiError("not_found", "Issue not found.");

    const comment = await issueActivityRepo(supabase).addComment({
      tenantId,
      issueId: id,
      authorId: null,
      authorLabel: parsed.data.author_label ?? "Forge Agent",
      body: parsed.data.body,
    });

    return apiOk({ id: comment.id, author_label: comment.authorLabel, body: comment.body, created_at: comment.createdAt }, 201);
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("POST /api/v1/issues/[id]/comments unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}
