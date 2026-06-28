import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireSuperAdmin } from "@/lib/super-admin";

export type GdprExportResult = {
  exported_at: string;
  subject_email: string;
  profile: Record<string, unknown> | null;
  memberships: Record<string, unknown>[];
  issues_created: Record<string, unknown>[];
  issue_comments: Record<string, unknown>[];
  issue_events: Record<string, unknown>[];
  api_keys: Record<string, unknown>[];
  compliance_requests: Record<string, unknown>[];
};

/**
 * Collect all personal data for a given email address.
 * Super-admin only. Returns structured JSON the operator can download.
 */
export async function exportSubjectData(email: string): Promise<GdprExportResult> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");

  const svc = createSupabaseServiceClient();
  const normalised = email.trim().toLowerCase();

  // Resolve user record (may not exist if they only submitted compliance request)
  const { data: user } = await svc
    .from("users")
    .select("id, name, email, created_at, updated_at")
    .eq("email", normalised)
    .maybeSingle();

  if (!user) {
    return {
      exported_at: new Date().toISOString(),
      subject_email: normalised,
      profile: null,
      memberships: [],
      issues_created: [],
      issue_comments: [],
      issue_events: [],
      api_keys: [],
      compliance_requests: [],
    };
  }

  const userId = user.id as string;

  const [
    membershipsRes,
    issuesRes,
    commentsRes,
    eventsRes,
    apiKeysRes,
    complianceRes,
  ] = await Promise.all([
    svc
      .from("memberships")
      .select("tenant_id, role, created_at")
      .eq("user_id", userId),
    svc
      .from("issues")
      .select("id, tenant_id, number, title, type, status, priority, created_at")
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false }),
    svc
      .from("issue_comments")
      .select("id, issue_id, body, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    svc
      .from("issue_events")
      // metadata is excluded: it contains internal system state that may reference
      // other users. Only subject-attributed fields are included in the export.
      .select("id, issue_id, event_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    svc
      .from("api_keys")
      .select("id, name, created_at, last_used_at, revoked_at")
      .eq("user_id", userId),
    svc
      .from("compliance_requests")
      .select("id, request_type, status, regulation, created_at, completed_at")
      .eq("requester_email", normalised),
  ]);

  return {
    exported_at: new Date().toISOString(),
    subject_email: normalised,
    profile: user as Record<string, unknown>,
    memberships: (membershipsRes.data ?? []) as Record<string, unknown>[],
    issues_created: (issuesRes.data ?? []) as Record<string, unknown>[],
    issue_comments: (commentsRes.data ?? []) as Record<string, unknown>[],
    issue_events: (eventsRes.data ?? []) as Record<string, unknown>[],
    api_keys: (apiKeysRes.data ?? []) as Record<string, unknown>[],
    compliance_requests: (complianceRes.data ?? []) as Record<string, unknown>[],
  };
}
