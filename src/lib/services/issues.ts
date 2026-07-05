import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo, type Issue, type IssueStatus } from "@/lib/repositories/issues";
import { fieldConfigRepo, type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { projectsRepo } from "@/lib/repositories/projects";
import { safeListCustomFields } from "@/lib/services/fieldConfig";
import { issueActivityRepo, type IssueComment, type IssueEvent } from "@/lib/repositories/issueActivity";
import { sendAssignedEmail, notifyIssueComment, notifyIssueAssigned } from "@/lib/services/notifications";
import { issueWatchersRepo } from "@/lib/repositories/issueWatchers";
import { fireWebhook } from "@/lib/services/webhooks";
import { triageIssue } from "@/lib/services/triage";
import { runAutomations } from "@/lib/services/automation";
import { notifyChat } from "@/lib/services/chatNotifications";

export type Project = { id: string; key: string; name: string };

export const BOARD_LIMIT = 200;
export const COLUMN_PAGE_SIZE = 50;

export type BoardData = {
  issues: Issue[];
  total: number;
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
};

/**
 * Load everything the board needs for a tenant (issues + projects + the tenant's
 * configured statuses/priorities/types/categories). When `projectId` is given,
 * issues are scoped to that project (the board is per-project). During
 * impersonation the caller (a super admin) isn't a member, so RLS would hide
 * everything — use the service-role client, still scoped to tenantId.
 */
export async function loadBoard(
  tenantId: string,
  _impersonating = false,
  projectId?: string
): Promise<BoardData> {
  // Always use the service client. Isolation is guaranteed by:
  // 1. getTenantContext() verifying membership at the page level
  // 2. Explicit tenant_id (and optionally project_id) filters on every query
  // This avoids Next.js async-context loss when cookies() is called inside Promise.all.
  const supabase = createSupabaseServiceClient();
  const cfg = fieldConfigRepo(supabase);

  let issueQuery = supabase
    .from("issues")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true })
    .limit(BOARD_LIMIT);
  if (projectId) issueQuery = issueQuery.eq("project_id", projectId);

  const [issuesRes, projects, options, categories, customFields] = await Promise.all([
    issueQuery,
    projectsRepo(supabase).listByTenant(tenantId),
    cfg.listOptions(tenantId),
    cfg.listCategories(tenantId),
    safeListCustomFields(supabase, tenantId),
  ]);

  return {
    issues: (issuesRes.data ?? []) as Issue[],
    total: issuesRes.count ?? 0,
    projects,
    statuses: options.filter((o) => o.field === "status"),
    priorities: options.filter((o) => o.field === "priority"),
    types: options.filter((o) => o.field === "type"),
    categories,
    customFields,
  };
}

/**
 * Create an issue from the web UI (human path). RLS authorizes the insert;
 * we still pass tenant_id explicitly (required column + machine-path discipline).
 */
export async function createIssue(input: {
  tenantId: string;
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  categoryId?: string | null;
  customValues?: Record<string, unknown>;
  reporterId?: string | null;
  sprintId?: string | null;
  assigneeId?: string | null;
}): Promise<Issue> {
  const supabase = await createSupabaseServerClient();

  // Block creation on archived projects.
  const project = await projectsRepo(supabase).getById(input.tenantId, input.projectId);
  if (project?.status === "archived") throw new Error("This project is archived. Reactivate it to add new issues.");

  // Fill any unspecified status/priority/type from the tenant's configured defaults.
  const defs = await fieldConfigRepo(supabase).listDefaults(input.tenantId);
  const def = (f: string) => defs.find((d) => d.field === f)?.key;

  const issue = await issuesRepo(supabase).create({
    tenant_id: input.tenantId,
    project_id: input.projectId,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? def("status") ?? "todo",
    priority: input.priority ?? def("priority") ?? "medium",
    type: input.type ?? def("type") ?? "bug",
    category_id: input.categoryId ?? null,
    custom_values: input.customValues ?? {},
    reporter_id: input.reporterId ?? null,
    sprint_id: input.sprintId ?? null,
    assignee_id: input.assigneeId ?? null,
    source: "web",
  });

  // Auto-watch the reporter so they receive comment notifications.
  if (input.reporterId) {
    void issueWatchersRepo(createSupabaseServiceClient())
      .watch(input.tenantId, issue.id, input.reporterId)
      .catch((e) => console.error("auto-watch reporter failed", e));
  }

  void fireWebhook(input.tenantId, "issue.created", { issue });
  void triageIssue(input.tenantId, issue.id);
  void runAutomations(input.tenantId, "issue.created", issue);
  void (async () => {
    try {
      const svc = createSupabaseServiceClient();
      const proj = await projectsRepo(svc).getById(input.tenantId, input.projectId);
      const { data: tenant } = await svc.from("tenants").select("slug").eq("id", input.tenantId).maybeSingle();
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
      const issueKey = proj ? `${proj.key}-${issue.number}` : `#${issue.number}`;
      void notifyChat(input.tenantId, {
        event: "created", issueKey, issueTitle: issue.title,
        issueUrl: `${baseUrl}/${tenant?.slug ?? input.tenantId}/issues/${issue.id}`,
        status: issue.status, priority: issue.priority,
      });
    } catch { /* best-effort */ }
  })();
  return issue;
}

/** Move an issue to a new status column (and optional position). */
export async function moveIssue(
  tenantId: string,
  id: string,
  status: IssueStatus,
  position?: number
): Promise<Issue> {
  const supabase = await createSupabaseServerClient();
  const patch: { status: IssueStatus; position?: number } = { status };
  if (typeof position === "number") patch.position = position;
  return issuesRepo(supabase).update(tenantId, id, patch);
}

/** Single issue for the detail page. `impersonating` → service-role (support view). */
export async function getIssue(tenantId: string, id: string, impersonating = false): Promise<Issue | null> {
  const supabase = impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  return issuesRepo(supabase).get(tenantId, id);
}

export type IssuePatch = {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  type?: string;
  categoryId?: string | null;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  phase?: string | null;
  storyPoints?: number | null;
  customValues?: Record<string, unknown>;
};

// Which fields produce a governance event, and how to read old/new off an issue.
const TRACKED: Array<{ field: string; patchKey: keyof IssuePatch; col: keyof Issue }> = [
  { field: "status", patchKey: "status", col: "status" },
  { field: "priority", patchKey: "priority", col: "priority" },
  { field: "type", patchKey: "type", col: "type" },
  { field: "assignee", patchKey: "assigneeId", col: "assignee_id" },
  { field: "category", patchKey: "categoryId", col: "category_id" },
  { field: "phase", patchKey: "phase", col: "phase" },
];

/**
 * Edit an issue from the detail page (human path; RLS allows owner/admin/member).
 * Records an append-only governance event for each changed tracked field, stamped
 * with the actor. Title/description changes log a single "details" event.
 */
export async function updateIssue(
  tenantId: string,
  id: string,
  patch: IssuePatch,
  actor?: { userId: string; label: string | null }
): Promise<Issue> {
  const supabase = await createSupabaseServerClient();
  const repo = issuesRepo(supabase);
  const before = await repo.get(tenantId, id);
  if (!before) throw new Error("Issue not found.");

  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.type !== undefined) dbPatch.type = patch.type;
  if (patch.categoryId !== undefined) dbPatch.category_id = patch.categoryId;
  if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
  if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate || null;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate || null;
  if (patch.phase !== undefined) dbPatch.phase = patch.phase || null;
  if (patch.storyPoints !== undefined) dbPatch.story_points = patch.storyPoints ?? null;
  if (patch.customValues !== undefined) dbPatch.custom_values = { ...before.custom_values, ...patch.customValues };

  const updated = await repo.update(tenantId, id, dbPatch);

  // Append-only history. Best-effort: never let logging fail the edit itself.
  if (actor) {
    try {
      const events = [];
      for (const t of TRACKED) {
        if (patch[t.patchKey] === undefined) continue;
        const oldVal = (before[t.col] as string | null) ?? null;
        const newVal = (updated[t.col] as string | null) ?? null;
        if (oldVal !== newVal) {
          events.push({
            tenantId,
            issueId: id,
            actorUserId: actor.userId,
            actorLabel: actor.label,
            field: t.field,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }
      const detailsChanged =
        (patch.title !== undefined && patch.title !== before.title) ||
        (patch.description !== undefined && (patch.description ?? null) !== before.description);
      if (detailsChanged) {
        events.push({
          tenantId,
          issueId: id,
          actorUserId: actor.userId,
          actorLabel: actor.label,
          field: "details",
          oldValue: null,
          newValue: null,
        });
      }
      await issueActivityRepo(supabase).addEvents(events);
    } catch (e) {
      console.error("issue_events logging failed", e);
    }
  }

  // Email + in-app notification: fire when assignee changes to a non-null user.
  const assigneeChanged =
    patch.assigneeId !== undefined &&
    patch.assigneeId !== null &&
    patch.assigneeId !== before.assignee_id;

  if (assigneeChanged && patch.assigneeId) {
    // Best-effort notification fire. Direct .from() calls here are accepted exceptions:
    // these are one-off cross-table lookups (user email, project key, tenant slug) that
    // exist solely to build a notification payload. Creating repo methods solely for this
    // caller would be artificial abstraction with no other consumer.
    void (async () => {
      try {
        const svc = createSupabaseServiceClient();
        // Verify assignee is a member of this tenant before reading their profile.
        const { data: membership } = await svc
          .from("memberships")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .eq("user_id", patch.assigneeId!)
          .maybeSingle();
        if (!membership) return;

        const { data: assignee } = await svc
          .from("users")
          .select("email, name")
          .eq("id", patch.assigneeId!)
          .maybeSingle();
        if (!assignee?.email) return;

        const { data: project } = await svc
          .from("projects")
          .select("key")
          .eq("tenant_id", tenantId)
          .eq("id", updated.project_id)
          .maybeSingle();

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
        const issueKey = project ? `${project.key}-${updated.number}` : `#${updated.number}`;

        // Look up tenant slug for the URL (notifications service also needs it but fetches independently).
        const { data: tenant } = await svc
          .from("tenants")
          .select("slug")
          .eq("id", tenantId)
          .maybeSingle();
        const issueUrl = `${baseUrl}/${tenant?.slug ?? tenantId}/issues/${updated.id}`;

        await sendAssignedEmail({
          tenantId,
          issueId: updated.id,
          issueKey,
          issueTitle: updated.title,
          issueStatus: updated.status,
          issuePriority: updated.priority,
          issueUrl,
          assigneeId: patch.assigneeId!,
          assigneeName: assignee.name ?? assignee.email,
          assigneeEmail: assignee.email,
          actorLabel: actor?.label ?? null,
        });

        void notifyIssueAssigned({
          tenantId,
          slug: tenant?.slug ?? tenantId,
          issueId: updated.id,
          issueKey,
          issueTitle: updated.title,
          assigneeId: patch.assigneeId!,
          actorId: actor?.userId ?? patch.assigneeId!,
          actorLabel: actor?.label ?? null,
        });
      } catch (e) {
        console.error("assignment notification failed", e);
      }
    })();
  }

  void fireWebhook(tenantId, "issue.updated", { issue: updated });
  if (patch.status !== undefined && patch.status !== before.status) {
    void runAutomations(tenantId, "issue.status_changed", updated);
  }
  if (patch.assigneeId !== undefined && patch.assigneeId !== before.assignee_id) {
    void runAutomations(tenantId, "issue.assigned", updated);
  }
  return updated;
}

/** Delete an issue (human path; RLS restricts to owner/admin). */
export async function deleteIssue(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // Capture before delete so webhook payload has context
  const issue = await issuesRepo(supabase).get(tenantId, id);
  await issuesRepo(supabase).delete(tenantId, id);
  if (issue) void fireWebhook(tenantId, "issue.deleted", { issue });
}

// ---- Issue activity (append-only comments + governance timeline) ----

export type IssueActivity = { comments: IssueComment[]; events: IssueEvent[] };

export async function loadIssueActivity(
  tenantId: string,
  issueId: string,
  impersonating = false
): Promise<IssueActivity> {
  const supabase = impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  const repo = issueActivityRepo(supabase);
  const [comments, events] = await Promise.all([
    repo.listComments(tenantId, issueId),
    repo.listEvents(tenantId, issueId),
  ]);
  return { comments, events };
}

/** Post a comment as the current user. RLS requires author_id = current user. */
export async function addIssueComment(input: {
  tenantId: string;
  issueId: string;
  authorId: string;
  authorLabel: string | null;
  body: string;
  parentId?: string | null;
  commentType?: "comment" | "decision";
}): Promise<IssueComment> {
  const body = input.body.trim();
  if (!body) throw new Error("Comment can’t be empty.");
  const supabase = await createSupabaseServerClient();
  const comment = await issueActivityRepo(supabase).addComment({ ...input, body });

  // Best-effort: resolve issue key for notification title
  void (async () => {
    try {
      const svc = createSupabaseServiceClient();
      const issue = await issuesRepo(svc).get(input.tenantId, input.issueId);
      if (!issue) return;
      const { data: project } = await svc.from("projects").select("key").eq("id", issue.project_id).maybeSingle();
      const { data: tenant } = await svc.from("tenants").select("slug").eq("id", input.tenantId).maybeSingle();
      const issueKey = project ? `${project.key}-${issue.number}` : `#${issue.number}`;
      await notifyIssueComment({
        tenantId: input.tenantId,
        slug: tenant?.slug ?? input.tenantId,
        issueId: input.issueId,
        issueKey,
        issueTitle: issue.title,
        authorId: input.authorId,
        authorLabel: input.authorLabel,
        commentBody: body,
      });
      void fireWebhook(input.tenantId, "comment.created", {
        comment: { id: comment.id, body: comment.body, authorId: input.authorId },
        issue: { id: input.issueId, key: issueKey, title: issue.title },
      });
      void runAutomations(input.tenantId, "comment.created", issue);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
      void notifyChat(input.tenantId, {
        event: "commented", issueKey, issueTitle: issue.title,
        issueUrl: `${baseUrl}/${tenant?.slug ?? input.tenantId}/issues/${input.issueId}`,
        actorLabel: input.authorLabel, commentBody: body,
      });
    } catch (e) {
      console.error("issue_comment notification failed", e);
    }
  })();

  return comment;
}
