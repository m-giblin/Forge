import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectsRepo } from "@/lib/repositories/projects";
import { ideasRepo } from "@/lib/repositories/ideas";
import { epicsRepo } from "@/lib/repositories/epics";
import { sprintsRepo } from "@/lib/repositories/sprints";
import { issuesRepo, type Issue } from "@/lib/repositories/issues";

export type MindMapNode = {
  id: string;
  kind: "idea" | "project" | "epic" | "sprint" | "issue";
  title: string;
  meta: string | null;
  status: string | null;
  progress: number | null;
  assignee: string | null;
  href: string | null;
  children: MindMapNode[];
};

/**
 * Builds the Idea -> Project -> Epic -> Sprint -> Issue tree for a project.
 * Root is the linked idea if one exists (Think Tank provenance), else the
 * project itself. Read-only — the mind map UI drives writes through its own
 * server actions and re-fetches this tree afterward.
 */
export async function buildProjectMindMapTree(
  supabase: SupabaseClient,
  tenantId: string,
  projectKey: string,
  slug: string
): Promise<MindMapNode | null> {
  const project = await projectsRepo(supabase).getByKey(tenantId, projectKey);
  if (!project) return null;

  const [epics, sprints, issues] = await Promise.all([
    // Graceful until migration 0104 (epics table) is applied.
    epicsRepo(supabase).listForProject(tenantId, project.id).catch(() => []),
    sprintsRepo(supabase).listForProject(tenantId, project.id),
    issuesRepo(supabase).list(tenantId, { projectId: project.id, limit: 100 }).then((r) => r.issues),
  ]);

  const issuesBySprintId = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (issue.sprint_id) {
      const arr = issuesBySprintId.get(issue.sprint_id) ?? [];
      arr.push(issue);
      issuesBySprintId.set(issue.sprint_id, arr);
    }
  }

  const sprintsByEpicId = new Map<string, typeof sprints>();
  const unassignedSprints: typeof sprints = [];
  for (const sprint of sprints) {
    if (sprint.epicId) {
      const arr = sprintsByEpicId.get(sprint.epicId) ?? [];
      arr.push(sprint);
      sprintsByEpicId.set(sprint.epicId, arr);
    } else {
      unassignedSprints.push(sprint);
    }
  }

  function issueNode(issue: Issue): MindMapNode {
    return {
      id: `issue-${issue.id}`,
      kind: "issue",
      title: issue.title,
      meta: `${project!.key}-${issue.number}`,
      status: issue.status,
      progress: null,
      assignee: issue.assignee_id ? "assigned" : null,
      href: `/${slug}/issues/${issue.id}`,
      children: [],
    };
  }

  function sprintNode(sprint: (typeof sprints)[number]): MindMapNode {
    const sprintIssues = issuesBySprintId.get(sprint.id) ?? [];
    const done = sprintIssues.filter((i) => i.status === "done" || i.status === "closed").length;
    return {
      id: `sprint-${sprint.id}`,
      kind: "sprint",
      title: sprint.name,
      meta: sprint.status === "active" ? "In progress" : sprint.status === "completed" ? "Done" : "Planned",
      status: sprint.status,
      progress: sprintIssues.length ? Math.round((done / sprintIssues.length) * 100) : null,
      assignee: null,
      href: `/${slug}/board?sprint=${sprint.id}`,
      children: sprintIssues.map(issueNode),
    };
  }

  function epicNode(epic: (typeof epics)[number]): MindMapNode {
    const epicSprints = sprintsByEpicId.get(epic.id) ?? [];
    return {
      id: `epic-${epic.id}`,
      kind: "epic",
      title: epic.title,
      meta: epicSprints.length ? `${epicSprints.length} sprint${epicSprints.length === 1 ? "" : "s"}` : "No sprints yet",
      status: epic.status,
      progress: null,
      assignee: null,
      href: null,
      children: epicSprints.map(sprintNode),
    };
  }

  const projectNode: MindMapNode = {
    id: `project-${project.id}`,
    kind: "project",
    title: project.name,
    meta: `${project.key} · ${project.status}`,
    status: project.status,
    progress: null,
    assignee: null,
    href: `/${slug}/projects/${project.key}`,
    // Sprints/issues with no epic yet still show, so nothing "disappears" once
    // Epics ship — a PM only has to file things under an epic when they want to.
    children: [...epics.map(epicNode), ...unassignedSprints.map(sprintNode)],
  };

  if (!project.linked_idea_id) return projectNode;

  const idea = await ideasRepo(supabase).getById(tenantId, project.linked_idea_id).catch(() => null);
  if (!idea) return projectNode;

  return {
    id: `idea-${idea.id}`,
    kind: "idea",
    title: idea.title,
    meta: "Converted from Think Tank",
    status: idea.status,
    progress: null,
    assignee: null,
    href: `/${slug}/think-tank/${idea.id}`,
    children: [projectNode],
  };
}
