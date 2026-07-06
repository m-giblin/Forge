import { apiError, apiOk } from "@/lib/api/response";
import { SCOPES } from "@/lib/api/scopes";
import { enforce } from "@/lib/api/gate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { fieldConfigRepo } from "@/lib/repositories/fieldConfig";

export const runtime = "nodejs";

/** GET /api/v1/projects/:key/categories — project-scoped category list. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const gate = await enforce(req, SCOPES.ISSUES_READ);
  if (gate.error) return gate.error;
  const { tenantId } = gate.auth;
  const { key } = await params;

  const svc = createSupabaseServiceClient();
  const project = await projectsRepo(svc).getByKey(tenantId, key);
  if (!project) return apiError("not_found", `No project with key "${key}".`);

  const categories = await fieldConfigRepo(svc).listCategories(tenantId, project.id);
  return apiOk(categories.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id, position: c.position })));
}
