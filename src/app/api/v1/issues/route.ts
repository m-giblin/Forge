import { NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { createIssueSchema } from "@/lib/api/schemas";
import { enforce } from "@/lib/api/gate";
import { resolveFieldValues } from "@/lib/api/validateFields";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo } from "@/lib/repositories/issues";
import { projectsRepo, type Project } from "@/lib/repositories/projects";
import { logger } from "@/lib/logger";
import { alertAdminsOfFallbackRouting, appendFallbackNote, type FallbackReason } from "@/lib/services/sdkFallbackAlerts";

// node:crypto in the auth layer requires the Node runtime.
export const runtime = "nodejs";

/** POST /api/v1/issues — create an issue (scope: issues:write). */
export async function POST(req: Request) {
  const gate = await enforce(req, SCOPES.ISSUES_WRITE);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be valid JSON.");
  }
  const parsed = createIssueSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_request", "Validation failed.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const input = parsed.data;

  // Machine path: the service-role client bypasses RLS, so we resolve and
  // inject tenant_id explicitly for every query.
  const supabase = createSupabaseServiceClient();
  const repo = issuesRepo(supabase);

  // Validate any provided status/priority/type against the tenant's config, and
  // get the tenant's defaults to fill in whatever wasn't specified.
  const fields = await resolveFieldValues(supabase, tenantId, {
    status: input.status, priority: input.priority, type: input.type,
  });
  if (!fields.ok) return apiError("invalid_request", fields.message);

  // Idempotency: if the client sends an Idempotency-Key it has seen before,
  // return the SAME issue instead of creating a duplicate (safe retries).
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim() || null;
  const ok201or200 = (issue: Awaited<ReturnType<typeof repo.create>>, projectKey: string, status: 200 | 201) =>
    apiOk({
      id: issue.id,
      key: `${projectKey}-${issue.number}`,
      number: issue.number,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      type: issue.type,
      assignee_id: issue.assignee_id,
      labels: issue.labels,
      category_id: issue.category_id,
      sprint_id: issue.sprint_id,
      parent_id: issue.parent_id,
      due_date: issue.due_date,
      start_date: issue.start_date,
      story_points: issue.story_points,
      environment: issue.environment,
      app_version: issue.app_version,
      stack_trace: issue.stack_trace,
      source: issue.source,
      phase: issue.phase,
      project: projectKey,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }, status);

  if (idempotencyKey) {
    const existing = await repo.getByExternalId(tenantId, idempotencyKey);
    if (existing) {
      const proj = await projectsRepo(supabase).getById(tenantId, existing.project_id);
      return ok201or200(existing, proj?.key ?? "?", 200);
    }
  }

  // Resolve project early so fingerprint dedup and create both use same project.
  const resolvedProject = input.projectKey
    ? await projectsRepo(supabase).getByKey(tenantId, input.projectKey)
    : await projectsRepo(supabase).getDefault(tenantId);
  if (!resolvedProject) {
    return apiError(
      "invalid_request",
      input.projectKey ? `No project with key "${input.projectKey}".` : "Tenant has no project to file into."
    );
  }

  // Route to the tenant's fallback project instead of silently filing into an
  // inactive project, or (within the suspension grace period) a suspended
  // tenant's project — never a black hole, always somewhere an admin sees it.
  let fallbackReason: FallbackReason | null = null;
  if (resolvedProject.status !== "active") {
    fallbackReason = { kind: "inactive_project", projectKey: resolvedProject.key, projectStatus: resolvedProject.status };
  } else if (gate.auth.tenantSuspension.suspended) {
    const { daysSinceSuspended, notifyDays, graceDays } = gate.auth.tenantSuspension;
    fallbackReason = daysSinceSuspended <= notifyDays
      ? { kind: "suspended_full_alert", daysSinceSuspended }
      : { kind: "suspended_warning", daysSinceSuspended, graceDays };
  }

  let project: Project = resolvedProject;
  if (fallbackReason) {
    project = await projectsRepo(supabase).getOrCreateFallbackProject(tenantId);
  }

  try {
    // Fingerprint dedup (FORGE-76): if caller supplies a fingerprint, check
    // whether an open issue for that error already exists in this project.
    // If so, bump occurrence_count + last_seen_at and return the existing issue.
    if (input.fingerprint) {
      const { data: existing } = await supabase
        .from("issues")
        .select("id, number, title, description, status, priority, type, assignee_id, labels, environment, created_at")
        .eq("tenant_id", tenantId)
        .eq("project_id", project.id)
        .eq("fingerprint", input.fingerprint)
        .not("status", "in", '("done","closed")')
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase.rpc("increment_issue_occurrence", { issue_id: existing.id });
        return ok201or200(existing as Parameters<typeof ok201or200>[0], project.key, 200);
      }
    }

    const description = fallbackReason
      ? appendFallbackNote(input.description ?? null, fallbackReason)
      : input.description ?? null;

    const issue = await repo.create({
      tenant_id: tenantId,
      project_id: project.id,
      title: input.title,
      description,
      status: input.status ?? fields.defaults.status,
      priority: input.priority ?? fields.defaults.priority,
      type: input.type ?? fields.defaults.type,
      environment: input.environment ?? null,
      app_version: input.appVersion ?? null,
      stack_trace: input.stackTrace ?? null,
      labels: input.labels ?? [],
      assignee_id: input.assignee_id ?? null,
      category_id: input.category_id ?? null,
      sprint_id: input.sprint_id ?? null,
      parent_id: input.parent_id ?? null,
      due_date: input.due_date ?? null,
      start_date: input.start_date ?? null,
      story_points: input.story_points ?? null,
      source: "api",
      external_id: idempotencyKey,
      fingerprint: input.fingerprint ?? null,
    });

    if (fallbackReason) {
      // Best-effort — a failed alert must never block the issue itself from
      // being returned to the caller (the ticket already exists either way).
      try {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("name, slug, billing_email")
          .eq("id", tenantId)
          .single();
        if (tenant) {
          await alertAdminsOfFallbackRouting(supabase, {
            tenantId,
            tenantSlug: tenant.slug,
            tenantName: tenant.name,
            billingEmail: tenant.billing_email,
            issueId: issue.id,
            issueKey: `${project.key}-${issue.number}`,
            reason: fallbackReason,
          });
        }
      } catch (e) {
        logger.error("Fallback-routing admin alert failed", { issueId: issue.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return ok201or200(issue, project.key, 201);
  } catch (e) {
    // Race: a concurrent retry inserted the same Idempotency-Key first.
    // The partial unique index rejects the dup (code 23505) — return the winner.
    if (idempotencyKey && typeof e === "object" && e !== null && (e as { code?: string }).code === "23505") {
      const existing = await repo.getByExternalId(tenantId, idempotencyKey);
      if (existing) return ok201or200(existing, project.key, 200);
    }
    const requestId = crypto.randomUUID();
    logger.error("POST /api/v1/issues unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}

/** GET /api/v1/issues — list issues (scope: issues:read). */
export async function GET(req: Request) {
  try {
    const gate = await enforce(req, SCOPES.ISSUES_READ);
    if (gate.error) return gate.error;
    const { tenantId } = gate.auth;

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const projectParam = url.searchParams.get("project"); // project key, e.g. "GEN"
    const qParam = url.searchParams.get("q");             // title substring search
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const supabase = createSupabaseServiceClient();

    // Validate project key format before touching the DB (returns 400, not 500, on bad input).
    if (projectParam && !/^[A-Z0-9]{1,10}$/.test(projectParam)) {
      return apiError("invalid_request", "project must be an alphanumeric key up to 10 characters (e.g. FORGE).");
    }

    // Resolve project key → id if provided.
    let projectId: string | undefined;
    if (projectParam) {
      const project = await projectsRepo(supabase).getByKey(tenantId, projectParam);
      if (!project) return apiError("not_found", `No project with key "${projectParam}".`);
      projectId = project.id;
    }

    // Validate and clamp pagination params (M-9: prevents NaN/negative/unbounded queries)
    const MAX_LIMIT = 200;
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : undefined;
    const parsedOffset = offsetParam ? parseInt(offsetParam, 10) : undefined;
    if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
      return apiError("invalid_request", "limit must be a positive integer.");
    }
    if (parsedOffset !== undefined && (isNaN(parsedOffset) || parsedOffset < 0)) {
      return apiError("invalid_request", "offset must be a non-negative integer.");
    }

    const { issues, total, limit, offset } = await issuesRepo(supabase).list(tenantId, {
      status: statusParam ?? undefined,
      projectId,
      q: qParam ?? undefined,
      limit: parsedLimit ? Math.min(parsedLimit, MAX_LIMIT) : undefined,
      offset: parsedOffset,
    });

    const data = issues.map((i) => ({
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
      sprint_id: i.sprint_id,
      parent_id: i.parent_id,
      due_date: i.due_date,
      start_date: i.start_date,
      story_points: i.story_points,
      environment: i.environment,
      app_version: i.app_version,
      source: i.source,
      phase: i.phase,
      created_at: i.created_at,
      updated_at: i.updated_at,
    }));
    return NextResponse.json({
      data,
      pagination: { limit, offset, total, has_more: offset + data.length < total },
    });
  } catch (e) {
    const requestId = crypto.randomUUID();
    logger.error("GET /api/v1/issues unhandled exception", {
      requestId,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return apiError("internal", "An unexpected error occurred.", undefined, requestId);
  }
}
