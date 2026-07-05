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
  environment: string | null; app_version: string | null; stack_trace: string | null;
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
    environment: i.environment,
    app_version: i.app_version,
    stack_trace: i.stack_trace,
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

    // Confirm the issue belongs to THIS key's tenant before updating (the update
    // is also tenant-scoped, but this gives a clean 404 instead of a silent no-op).
    const existing = await repo.get(tenantId, id);
    if (!existing) return apiError("not_found", "Issue not found.");

    // status/priority/type are configurable text now; the repo's Issue type still
    // narrows them to the seeded unions (reconciled in the board refactor). Cast.
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
