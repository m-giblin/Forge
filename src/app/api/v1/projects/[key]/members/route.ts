import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { projectMembersRepo } from "@/lib/repositories/projectMembers";

export const runtime = "nodejs";

/**
 * GET /api/v1/projects/:key/members — real, current project team, for
 * populating an "assignee" dropdown in an external client. Scope: issues:read
 * (there's no dedicated projects:read scope yet; this is read-only metadata
 * needed to file issues correctly, so it rides on the same scope as issue reads).
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const gate = await enforce(req, SCOPES.ISSUES_READ);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { key } = await params;

  const svc = createSupabaseServiceClient();
  const project = await projectsRepo(svc).getByKey(tenantId, key);
  if (!project) return apiError("not_found", `No project with key "${key}".`);

  const members = await projectMembersRepo(svc).list(tenantId, project.id);
  return apiOk(
    members.map((m) => ({ id: m.userId, name: m.name, email: m.email, role: m.role }))
  );
}
