import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo, type Project, type ProjectStatus } from "@/lib/repositories/projects";
import { issuesRepo } from "@/lib/repositories/issues";
import { projectMembersRepo, type ProjectMemberRow } from "@/lib/repositories/projectMembers";
import type { MembershipRole } from "@/lib/repositories/members";

async function readClient(impersonating: boolean) {
  return impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
}

const KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/;

function isAdmin(role: MembershipRole) {
  return role === "owner" || role === "admin";
}

/**
 * Projects this user should see on the landing page. Admins/owners see every
 * project in the tenant; everyone else sees only the projects whose team they're
 * on (project_members). Super-admin support view (impersonating) sees all.
 */
/** Non-archived projects the user can see. Admins get all; members get their team projects. */
export async function listVisibleProjects(
  tenantId: string,
  appUserId: string,
  role: MembershipRole,
  impersonating = false
): Promise<Project[]> {
  const repo = projectsRepo(await readClient(impersonating));
  if (impersonating || isAdmin(role)) return repo.listByTenant(tenantId);
  return repo.listForMember(tenantId, appUserId);
}

/** Admin-only: archived projects for the archive tab. */
export async function listArchivedProjects(
  tenantId: string,
  impersonating = false
): Promise<Project[]> {
  return projectsRepo(await readClient(impersonating)).listByTenant(tenantId, ["archived"]);
}

export async function changeProjectStatus(
  tenantId: string,
  projectKey: string,
  status: ProjectStatus,
  role: MembershipRole,
  impersonating = false
): Promise<void> {
  if (!isAdmin(role)) throw new Error("Only owners and admins can change project status.");
  const supabase = await readClient(impersonating);
  const project = await projectsRepo(supabase).getByKey(tenantId, projectKey);
  if (!project) throw new Error("Project not found.");
  await projectsRepo(supabase).updateStatus(tenantId, project.id, status);
}

export async function deleteProject(
  tenantId: string,
  projectKey: string,
  role: MembershipRole,
): Promise<void> {
  if (!isAdmin(role)) throw new Error("Only owners and admins can delete projects.");
  const supabase = createSupabaseServiceClient();
  const project = await projectsRepo(supabase).getByKey(tenantId, projectKey);
  if (!project) throw new Error("Project not found.");
  const issueCount = await issuesRepo(supabase).countForProject(tenantId, project.id);
  if (issueCount.total > 0) throw new Error(`Cannot delete: project has ${issueCount.total} issue${issueCount.total === 1 ? "" : "s"}. Archive it instead.`);
  await projectsRepo(supabase).deleteById(tenantId, project.id);
}

/** Derive a project key (e.g. "Website Redesign" -> "WEB") and de-dupe it. */
function deriveKey(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (letters.slice(0, 3) || "PRJ").padEnd(2, "X");
}

async function uniqueKey(tenantId: string, base: string, supabase: Awaited<ReturnType<typeof readClient>>): Promise<string> {
  const repo = projectsRepo(supabase);
  if (!(await repo.getByKey(tenantId, base))) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}${i}`.slice(0, 10);
    if (!(await repo.getByKey(tenantId, candidate))) return candidate;
  }
  throw new Error("Could not generate a unique project key.");
}

/**
 * Create a project from the intake form (owner, start date, go-live date) and
 * seed its team with the owner so they immediately see it on the landing page.
 * Human path: RLS authorizes the insert; we still pass tenant_id explicitly.
 */
export async function createProject(input: {
  tenantId: string;
  name: string;
  key?: string | null;
  ownerUserId?: string | null;
  startDate?: string | null;
  targetGoLive?: string | null;
}): Promise<Project> {
  const supabase = await createSupabaseServerClient();
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");

  let key = (input.key ?? "").trim().toUpperCase();
  if (key && !KEY_RE.test(key)) {
    throw new Error("Key must be 2–10 chars: an uppercase letter then letters/numbers (e.g. WEB).");
  }
  if (!key) key = await uniqueKey(input.tenantId, deriveKey(name), supabase);
  else if (await projectsRepo(supabase).getByKey(input.tenantId, key)) {
    throw new Error(`Project key "${key}" is already in use.`);
  }

  const project = await projectsRepo(supabase).create({
    tenant_id: input.tenantId,
    key,
    name,
    lead_user_id: input.ownerUserId ?? null,
    start_date: input.startDate || null,
    target_go_live: input.targetGoLive || null,
  });

  // Seed the team with the owner so the project shows up for them.
  if (input.ownerUserId) {
    await projectMembersRepo(supabase).add(input.tenantId, project.id, input.ownerUserId, "owner");
  }
  return project;
}

// ---- Project team (admin add/remove) ----

export async function listProjectTeam(
  tenantId: string,
  projectId: string,
  impersonating = false
): Promise<ProjectMemberRow[]> {
  return projectMembersRepo(await readClient(impersonating)).list(tenantId, projectId);
}

export async function addProjectMember(tenantId: string, projectId: string, userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await projectMembersRepo(supabase).add(tenantId, projectId, userId, "member");
}

export async function removeProjectMember(tenantId: string, projectId: string, userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await projectMembersRepo(supabase).remove(tenantId, projectId, userId);
}
