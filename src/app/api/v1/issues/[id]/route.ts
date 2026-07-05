import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { updateIssueSchema } from "@/lib/api/schemas";
import { enforce } from "@/lib/api/gate";
import { resolveFieldValues } from "@/lib/api/validateFields";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo } from "@/lib/repositories/issues";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function serialize(i: {
  id: string; number: number; title: string; description: string | null;
  status: string; priority: string; type: string;
  assignee_id: string | null; labels: string[];
  category_id: string | null; sprint_id?: string | null; parent_id?: string | null;
  due_date: string | null; start_date: string | null; story_points: number | null;
  environment: string | null; app_version: string | null; stack_trace: string | null;
  source: string; phase: string | null;
  created_at: string; updated_at: string;
}) {
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    description: i.description,
    status: i.status,
    priority: i.priority,
    type: i.type,
    assignee_id: i.assignee_id,
    labels: i.labels,
    category_id: i.category_id,
    sprint_id: i.sprint_id ?? null,
    parent_id: i.parent_id ?? null,
    due_date: i.due_date,
    start_date: i.start_date,
    story_points: i.story_points,
    environment: i.environment,
    app_version: i.app_version,
    stack_trace: i.stack_trace,
    source: i.source,
    phase: i.phase,
    created_at: i.created_at,
    updated_at: i.updated_at,
  };
}

/** GET /api/v1/issues/{id} — single issue (scope: issues:read). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_READ);
    if (gate.error) return gate.error;
    const { id } = await params;

    const supabase = createSupabaseServiceClient();
    const issue = await issuesRepo(supabase).get(gate.auth.tenantId, id);
    if (!issue) return apiError("not_found", "Issue not found.");
    return apiOk(serialize(issue));
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("GET /api/v1/issues/[id] unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}

/** PATCH /api/v1/issues/{id} — update an issue (scope: issues:write). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const parsed = updateIssueSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("invalid_request", "Validation failed.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    const supabase = createSupabaseServiceClient();
    const repo = issuesRepo(supabase);

    // Validate provided status/priority/type against the tenant's config.
    const fields = await resolveFieldValues(supabase, tenantId, {
      status: parsed.data.status, priority: parsed.data.priority, type: parsed.data.type,
    });
    if (!fields.ok) return apiError("invalid_request", fields.message);

    const existing = await repo.get(tenantId, id);
    if (!existing) return apiError("not_found", "Issue not found.");

    const updated = await repo.update(tenantId, id, parsed.data as Parameters<typeof repo.update>[2]);
    return apiOk(serialize(updated));
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("PATCH /api/v1/issues/[id] unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}

/** DELETE /api/v1/issues/{id} — delete an issue (scope: issues:write). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_WRITE);
    if (gate.error) return gate.error;
    const { id } = await params;
    const { tenantId } = gate.auth;

    const supabase = createSupabaseServiceClient();
    const repo = issuesRepo(supabase);

    const existing = await repo.get(tenantId, id);
    if (!existing) return apiError("not_found", "Issue not found.");

    await repo.delete(tenantId, id);
    return apiOk({ deleted: true, id });
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("DELETE /api/v1/issues/[id] unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}
