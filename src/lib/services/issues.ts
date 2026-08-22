import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { issuesRepo, type Issue, type IssueStatus } from "@/lib/repositories/issues";
import { fieldConfigRepo, type FieldOption, type Category, type CustomField } from "@/lib/repositories/fieldConfig";
import { issueTemplatesRepo, type IssueTemplate } from "@/lib/repositories/issueTemplates";
import { projectsRepo } from "@/lib/repositories/projects";
import { safeListCustomFields } from "@/lib/services/fieldConfig";
import { issueActivityRepo, type IssueComment, type IssueEvent } from "@/lib/repositories/issueActivity";
import { sendAssignedEmail, notifyIssueComment, notifyIssueAssigned } from "@/lib/services/notifications";
import { notifyChat } from "@/lib/services/chatNotifications";
import { issueWatchersRepo } from "@/lib/repositories/issueWatchers";
import { issueAssigneesRepo } from "@/lib/repositories/issueAssignees";
import { fireWebhook } from "@/lib/services/webhooks";
import { triageIssue } from "@/lib/services/triage";
import { runAutomations } from "@/lib/services/automation";
import { sanitizeCustomValues } from "@/lib/api/validateFields";

export type Project = { id: string; key: string; name: string };

export const COLUMN_PAGE_SIZE = 50;

export type BoardColumnInfo = { hasMore: boolean; cursor: number | null };

export type BoardData = {
  issues: Issue[];
  /** Per-status fetch state — which columns are already known to have more
   * beyond what's in `issues`, and the position cursor to resume from. */
  columnInfo: Record<string, BoardColumnInfo>;
  projects: Project[];
  statuses: FieldOption[];
  priorities: FieldOption[];
  types: FieldOption[];
  categories: Category[];
  customFields: CustomField[];
  templates: IssueTemplate[];
};

/**
 * Load everything the board needs for a tenant (issues + projects + the tenant's
 * configured statuses/priorities/types/categories). When `projectId` is given,
 * issues are scoped to that project (the board is per-project). During
 * impersonation the caller (a super admin) isn't a member, so RLS would hide
 * everything — use the service-role client, still scoped to tenantId.
 *
 * Issues are fetched per-status (one bounded query per configured status,
 * in parallel) rather than one query sharing a single global LIMIT across
 * every status. A single shared budget lets whichever status has the most
 * (or oldest) issues starve the others — a project with 150 Done issues and
 * 10 Backlog issues would see the shared page fill with Done, leaving
 * newly-created Backlog issues fetched last and pushed out entirely. This
 * way every column gets its own fair page on first paint, regardless of how
 * unevenly issues are distributed across statuses (FORGE: TRAV2-202/203
 * existed but were invisible on the board once the project passed the old
 * shared 200-row cap).
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

  const [projects, options, categories, customFields, templates] = await Promise.all([
    projectsRepo(supabase).listByTenant(tenantId),
    cfg.listOptions(tenantId),
    cfg.listCategories(tenantId, projectId),
    safeListCustomFields(supabase, tenantId),
    issueTemplatesRepo(supabase).list(tenantId),
  ]);

  const statuses = options.filter((o) => o.field === "status");

  const perStatus = await Promise.all(
    statuses.map(async (s) => {
      let q = supabase
        .from("issues")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", s.key)
        .order("position", { ascending: true })
        // Fetch one extra row so "is there more" is known from this single
        // query, with no separate count round-trip.
        .limit(COLUMN_PAGE_SIZE + 1);
      if (projectId) q = q.eq("project_id", projectId);
      const { data } = await q;
      const rows = (data ?? []) as Issue[];
      const hasMore = rows.length > COLUMN_PAGE_SIZE;
      const page = hasMore ? rows.slice(0, COLUMN_PAGE_SIZE) : rows;
      const cursor = page.length > 0 ? page[page.length - 1].position : null;
      return { key: s.key, issues: page, hasMore, cursor };
    })
  );

  const columnInfo: Record<string, BoardColumnInfo> = {};
  for (const p of perStatus) columnInfo[p.key] = { hasMore: p.hasMore, cursor: p.cursor };

  return {
    issues: perStatus.flatMap((p) => p.issues),
    columnInfo,
    projects,
    statuses,
    priorities: options.filter((o) => o.field === "priority"),
    types: options.filter((o) => o.field === "type"),
    categories,
    customFields,
    templates,
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
    custom_values: sanitizeCustomValues(input.customValues),
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

/**
 * Enforces the tenant's "restrict status changes to adjacent workflow steps"
 * toggle (fields admin page). No-op when the toggle is off or either status
 * isn't a configured option (e.g. a stale/deleted value) — fail open rather
 * than block a legitimate move on bad config.
 */
async function assertValidStatusTransition(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  if (fromStatus === toStatus) return;
  const { data: tenantRow } = await supabase.from("tenants").select("restrict_status_transitions").eq("id", tenantId).maybeSingle();
  if (!tenantRow?.restrict_status_transitions) return;

  const statuses = (await fieldConfigRepo(supabase).listOptions(tenantId)).filter((o) => o.field === "status");
  const fromIdx = statuses.findIndex((s) => s.key === fromStatus);
  const toIdx = statuses.findIndex((s) => s.key === toStatus);
  if (fromIdx === -1 || toIdx === -1) return;
  if (Math.abs(toIdx - fromIdx) !== 1) {
    throw new Error(`This workspace only allows moving between adjacent statuses. Move through "${statuses[fromIdx + (toIdx > fromIdx ? 1 : -1)]?.label}" first.`);
  }
}

/** Move an issue to a new status column (and optional position). */
export async function moveIssue(
  tenantId: string,
  id: string,
  status: IssueStatus,
  position?: number
): Promise<Issue> {
  const supabase = await createSupabaseServerClient();
  const repo = issuesRepo(supabase);
  const before = await repo.get(tenantId, id);
  if (before) await assertValidStatusTransition(supabase, tenantId, before.status, status);
  const patch: { status: IssueStatus; position?: number } = { status };
  if (typeof position === "number") patch.position = position;
  return repo.update(tenantId, id, patch);
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
  componentId?: string | null;
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
  { field: "component", patchKey: "componentId", col: "component_id" },
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

  if (patch.status !== undefined) await assertValidStatusTransition(supabase, tenantId, before.status, patch.status);

  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.type !== undefined) dbPatch.type = patch.type;
  if (patch.categoryId !== undefined) dbPatch.category_id = patch.categoryId;
  if (patch.componentId !== undefined) dbPatch.component_id = patch.componentId;
  if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
  if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate || null;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate || null;
  if (patch.phase !== undefined) dbPatch.phase = patch.phase || null;
  if (patch.storyPoints !== undefined) dbPatch.story_points = patch.storyPoints ?? null;
  if (patch.customValues !== undefined) dbPatch.custom_values = sanitizeCustomValues({ ...before.custom_values, ...patch.customValues });

  const updated = await repo.update(tenantId, id, dbPatch);

  // Keep the assignee SET (0087) consistent with the primary: setting a non-null
  // primary guarantees they're also in issue_assignees. Previous assignees are
  // kept — changing the DRI doesn't silently unassign anyone. Best-effort.
  if (patch.assigneeId !== undefined && patch.assigneeId) {
    try {
      await issueAssigneesRepo(supabase).add(tenantId, id, patch.assigneeId);
    } catch (e) {
      console.error("issue_assignees primary-sync failed", e);
    }
  }

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

        void notifyChat(tenantId, {
          event: "assigned",
          issueKey,
          issueTitle: updated.title,
          issueUrl,
          status: updated.status,
          priority: updated.priority,
          actorLabel: actor?.label ?? null,
          assigneeName: assignee.name ?? assignee.email,
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
