import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { sprintsRepo } from "@/lib/repositories/sprints";

export const runtime = "nodejs";

/**
 * GET /api/v1/projects/:key/sprints — real, current sprints for this project
 * (planned + active + completed), for populating a "sprint" dropdown.
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const gate = await enforce(req, SCOPES.ISSUES_READ);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { key } = await params;

  const svc = createSupabaseServiceClient();
  const project = await projectsRepo(svc).getByKey(tenantId, key);
  if (!project) return apiError("not_found", `No project with key "${key}".`);

  const sprints = await sprintsRepo(svc).listForProject(tenantId, project.id);
  return apiOk(
    sprints.map((s) => ({ id: s.id, name: s.name, status: s.status, startDate: s.startDate, endDate: s.endDate }))
  );
}
