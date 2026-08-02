import "server-only";
import { Resend } from "resend";
import { getSetting } from "@/lib/platformSettings";
import { getTenantSettings } from "@/lib/tenantSettings";
import { buildAssignmentEmail, buildMergeNotificationEmail, type OpenTicket, type MergedIssue } from "@/lib/emailTemplate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { issueWatchersRepo } from "@/lib/repositories/issueWatchers";
import { ideasRepo } from "@/lib/repositories/ideas";
import { membersRepo } from "@/lib/repositories/members";

async function getResendClient(): Promise<Resend | null> {
  const dbKey = await getSetting("resend_api_key");
  const key = dbKey || process.env.RESEND_API_KEY || null;
  return key ? new Resend(key) : null;
}

export async function sendAssignedEmail(opts: {
  tenantId: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
  issueStatus: string;
  issuePriority: string;
  issueUrl: string;
  assigneeId: string;
  assigneeName: string;
  assigneeEmail: string;
  actorLabel: string | null;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();

  // Accepted exception: notification assembly requires cross-table data (issues,
  // projects, tenants) in a single coordinated fetch. Wrapping each in a repo method
  // would add indirection with no benefit — this is the only consumer of this shape.
  // Fetch everything in parallel.
  const [resend, branding, openIssuesResult, unassignedResult] = await Promise.all([
    getResendClient(),

    // Per-tenant email branding.
    getTenantSettings(opts.tenantId, ["email_display_name", "email_primary_color", "email_from_name"]),

    // All open tickets for this assignee in this tenant.
    supabase
      .from("issues")
      .select("id, number, title, status, priority, project_id")
      .eq("tenant_id", opts.tenantId)
      .eq("assignee_id", opts.assigneeId)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(20),

    // Count of unassigned open tickets.
    supabase
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", opts.tenantId)
      .is("assignee_id", null)
      .neq("status", "done"),
  ]);

  // Resolve project keys for the open issues.
  const projectIds = [...new Set((openIssuesResult.data ?? []).map((i) => i.project_id as string))];
  const projectKeyMap: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, key")
      .in("id", projectIds);
    for (const p of projects ?? []) projectKeyMap[p.id] = p.key;
  }

  const openTickets: OpenTicket[] = (openIssuesResult.data ?? []).map((i) => ({
    key: `${projectKeyMap[i.project_id] ?? "??"}-${i.number}`,
    title: i.title,
    status: i.status,
    priority: i.priority,
  }));

  const tenantName = branding["email_display_name"] || "Your Workspace";
  const primaryColor = branding["email_primary_color"] || "#111827";
  const fromName = branding["email_from_name"] || `${tenantName} via Forge`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", opts.tenantId)
    .maybeSingle();
  const boardUrl = `${baseUrl}/${tenant?.slug ?? opts.tenantId}/board`;

  const { subject, html } = buildAssignmentEmail({
    tenantDisplayName: tenantName,
    tenantPrimaryColor: primaryColor,
    assigneeName: opts.assigneeName,
    assigneeEmail: opts.assigneeEmail,
    actorLabel: opts.actorLabel ?? "Someone",
    issueKey: opts.issueKey,
    issueTitle: opts.issueTitle,
    issuePriority: opts.issuePriority,
    issueStatus: opts.issueStatus,
    issueUrl: opts.issueUrl,
    openTickets,
    unassignedCount: unassignedResult.count ?? 0,
    boardUrl,
  });

  // Create in-app notification (best-effort, non-blocking).
  void notificationsRepo(supabase)
    .create({
      tenantId: opts.tenantId,
      userId: opts.assigneeId,
      type: "assigned",
      title: `Assigned: ${opts.issueKey} — ${opts.issueTitle}`,
      body: `Assigned by ${opts.actorLabel ?? "someone"}`,
      issueId: opts.issueId,
    })
    .catch((e) => console.error("in-app notification failed", e));

  // Send email if Resend is configured.
  if (!resend) return;

  await resend.emails.send({
    from: `${fromName} <notifications@forge.app>`,
    to: opts.assigneeEmail,
    subject,
    html,
  });
}

// ---------------------------------------------------------------------------
// Password reset — a verification code entered directly in Forge, not a link to
// click. Sent via the app's own Resend pipeline rather than Supabase Auth's
// built-in (unconfigured-SMTP) email delivery. Whether it's self-service
// (login page "Forgot password?") or admin-triggered (Admin → Members →
// "Send password reset"), the recipient always ends up on the same in-app
// screen — enter the code + a new password — never redirected out to click
// something and get bounced back.
// ---------------------------------------------------------------------------

export async function sendPasswordResetCodeEmail(opts: {
  tenantId?: string;
  toEmail: string;
  code: string;
  triggeredByAdmin?: boolean;
}): Promise<boolean> {
  const [resend, branding] = await Promise.all([
    getResendClient(),
    opts.tenantId
      ? getTenantSettings(opts.tenantId, ["email_display_name", "email_primary_color", "email_from_name"])
      : Promise.resolve({} as Record<string, string>),
  ]);
  if (!resend) return false;

  const tenantName = branding["email_display_name"] || "Forge-Worx";
  const primaryColor = branding["email_primary_color"] || "#b7452f";
  const fromName = branding["email_from_name"] || `${tenantName}${opts.tenantId ? " via Forge-Worx" : ""}`;
  const context = opts.triggeredByAdmin
    ? `An admin at ${tenantName} requested a password reset for your account.`
    : `Use this code to reset your ${tenantName} password.`;

  await resend.emails.send({
    from: `${fromName} <notifications@forge.app>`,
    to: opts.toEmail,
    subject: `Your ${tenantName} password reset code`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:${primaryColor};margin:0 0 12px;">Reset your password</h2>
        <p style="color:#333;font-size:14px;line-height:1.5;">${context} Enter it on the reset screen along with a new password — this code expires in 60 minutes.</p>
        <p style="margin:24px 0;text-align:center;">
          <span style="display:inline-block;background:#f4f2eb;border:1px solid #ddd8c9;border-radius:8px;padding:14px 28px;font-family:monospace;font-size:28px;font-weight:700;letter-spacing:0.3em;color:${primaryColor};">${opts.code}</span>
        </p>
        <p style="color:#999;font-size:12px;">If you didn't request this, you can safely ignore this email — your password won't change unless this code is entered.</p>
      </div>
    `,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Merge notification — emails every owner/admin in the tenant when a PR
// linked to a Forge issue merges. Fires once per merged PR (not once per
// linked issue), summarizing everything the merge touched.
// ---------------------------------------------------------------------------

export async function sendMergeNotificationEmail(opts: {
  tenantId: string;
  repoFullName: string;
  prTitle: string;
  prNumber: number;
  prUrl: string;
  mergedBy: string;
  issues: MergedIssue[];
}): Promise<boolean> {
  if (opts.issues.length === 0) return false;

  const svc = createSupabaseServiceClient();
  const [resend, branding, adminIds] = await Promise.all([
    getResendClient(),
    getTenantSettings(opts.tenantId, ["email_display_name", "email_primary_color", "email_from_name"]),
    membersRepo(svc).listAdminUserIds(opts.tenantId),
  ]);
  if (!resend || adminIds.length === 0) return false;

  const { data: admins } = await svc.from("users").select("email").in("id", adminIds);
  const adminEmails = (admins ?? []).map((a) => a.email as string).filter(Boolean);
  if (adminEmails.length === 0) return false;

  const tenantName = branding["email_display_name"] || "Forge-Worx";
  const primaryColor = branding["email_primary_color"] || "#7a4fa0";
  const fromName = branding["email_from_name"] || `${tenantName} via Forge-Worx`;

  const { subject, html } = buildMergeNotificationEmail({
    tenantDisplayName: tenantName,
    tenantPrimaryColor: primaryColor,
    repoFullName: opts.repoFullName,
    prTitle: opts.prTitle,
    prNumber: opts.prNumber,
    prUrl: opts.prUrl,
    mergedBy: opts.mergedBy,
    issues: opts.issues,
  });

  await resend.emails.send({
    from: `${fromName} <notifications@forge.app>`,
    to: adminEmails,
    subject,
    html,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Think Tank notifications — in-app only (no email in Phase 2)
// ---------------------------------------------------------------------------

/** Parse @name mentions from comment body. Returns lower-cased names. */
function extractMentions(body: string): string[] {
  const matches = body.match(/@([\w.-]+)/g) ?? [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

/**
 * Fires after a new comment is posted on an idea.
 * Notifies: idea creator + assignee (if different from commenter), plus any @mentions.
 */
export async function notifyIdeaComment(opts: {
  tenantId: string;
  slug: string;
  ideaId: string;
  ideaTitle: string;
  authorId: string;
  authorName: string | null;
  commentBody: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const repo = notificationsRepo(supabase);

  const [idea, members] = await Promise.all([
    ideasRepo(supabase).getById(opts.tenantId, opts.ideaId),
    membersRepo(supabase).list(opts.tenantId),
  ]);
  if (!idea) return;

  const notify = new Set<string>();
  if (idea.created_by && idea.created_by !== opts.authorId) notify.add(idea.created_by);
  if (idea.assigned_to && idea.assigned_to !== opts.authorId) notify.add(idea.assigned_to);

  // @mention resolution — match against member names (case-insensitive)
  const mentions = extractMentions(opts.commentBody);
  if (mentions.length > 0) {
    for (const m of members) {
      const name = (m.name ?? m.email ?? "").toLowerCase();
      if (mentions.some((mention) => name.includes(mention))) {
        if (m.userId !== opts.authorId) notify.add(m.userId);
      }
    }
  }

  const linkPath = `/${opts.slug}/think-tank/${opts.ideaId}`;
  const actorLabel = opts.authorName ?? "Someone";
  const title = `💬 New comment on "${opts.ideaTitle}"`;
  const body = `${actorLabel} commented`;

  await Promise.all(
    [...notify].map((userId) =>
      repo.create({ tenantId: opts.tenantId, userId, type: "idea_comment", title, body, linkPath })
        .catch((e) => console.error("idea_comment notification failed", e))
    )
  );
}

/**
 * Fires when an idea's status changes.
 * Notifies: idea creator (if not the one who changed it).
 */
export async function notifyIdeaStatusChange(opts: {
  tenantId: string;
  slug: string;
  ideaId: string;
  ideaTitle: string;
  creatorId: string | null;
  actorId: string;
  actorName: string | null;
  newStatus: string;
}): Promise<void> {
  if (!opts.creatorId || opts.creatorId === opts.actorId) return;
  const supabase = createSupabaseServiceClient();
  const linkPath = `/${opts.slug}/think-tank/${opts.ideaId}`;
  await notificationsRepo(supabase)
    .create({
      tenantId: opts.tenantId,
      userId: opts.creatorId,
      type: "idea_status",
      title: `📋 "${opts.ideaTitle}" moved to ${opts.newStatus}`,
      body: `Updated by ${opts.actorName ?? "someone"}`,
      linkPath,
    })
    .catch((e) => console.error("idea_status notification failed", e));
}

/**
 * Fires when an idea is converted to a project.
 * Notifies: idea creator (if not the converter).
 */
export async function notifyIdeaConverted(opts: {
  tenantId: string;
  slug: string;
  ideaId: string;
  ideaTitle: string;
  creatorId: string | null;
  actorId: string;
  actorName: string | null;
  projectKey: string;
}): Promise<void> {
  if (!opts.creatorId || opts.creatorId === opts.actorId) return;
  const supabase = createSupabaseServiceClient();
  const linkPath = `/${opts.slug}/projects/${opts.projectKey}`;
  await notificationsRepo(supabase)
    .create({
      tenantId: opts.tenantId,
      userId: opts.creatorId,
      type: "idea_converted",
      title: `🚀 "${opts.ideaTitle}" converted to project ${opts.projectKey}`,
      body: `Converted by ${opts.actorName ?? "someone"}`,
      linkPath,
    })
    .catch((e) => console.error("idea_converted notification failed", e));
}

// ---------------------------------------------------------------------------
// Issue notifications — @mentions + watcher fanout
// ---------------------------------------------------------------------------

/**
 * Fires after a comment is posted on an issue.
 * - Resolves @mention names against tenant members
 * - Auto-watches the commenter, mentioned users
 * - Notifies all watchers except the commenter
 */
export async function notifyIssueComment(opts: {
  tenantId: string;
  slug: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
  authorId: string;
  authorLabel: string | null;
  commentBody: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const notif = notificationsRepo(supabase);
  const watchers = issueWatchersRepo(supabase);
  const members = await membersRepo(supabase).list(opts.tenantId);

  // Resolve @mentions → user IDs
  const mentions = extractMentions(opts.commentBody);
  const mentionedIds: string[] = [];
  if (mentions.length > 0) {
    for (const m of members) {
      const name = (m.name ?? m.email ?? "").toLowerCase();
      if (mentions.some((mention) => name.includes(mention)) && m.userId !== opts.authorId) {
        mentionedIds.push(m.userId);
      }
    }
  }

  // Auto-watch: commenter + mentioned users
  await watchers.watchMany(opts.tenantId, opts.issueId, [opts.authorId, ...mentionedIds]);

  // Notify all current watchers (after auto-watch so mentioned are included)
  const currentWatchers = await watchers.list(opts.tenantId, opts.issueId);
  const linkPath = `/${opts.slug}/issues/${opts.issueId}`;
  const actor = opts.authorLabel ?? "Someone";

  const toNotify = currentWatchers
    .filter((w) => w.userId !== opts.authorId)
    .map((w) => w.userId);

  // Mention-specific notifications first
  const mentionSet = new Set(mentionedIds);
  await Promise.all(
    toNotify.map((userId) => {
      const isMentioned = mentionSet.has(userId);
      return notif.create({
        tenantId: opts.tenantId,
        userId,
        type: isMentioned ? "mention" : "issue_comment",
        title: isMentioned
          ? `@mentioned in ${opts.issueKey}: ${opts.issueTitle}`
          : `💬 New comment on ${opts.issueKey}: ${opts.issueTitle}`,
        body: `${actor}: ${opts.commentBody.slice(0, 100)}${opts.commentBody.length > 100 ? "…" : ""}`,
        issueId: opts.issueId,
        linkPath,
      }).catch((e) => console.error("issue_comment notification failed", e));
    })
  );
}

/**
 * Fires when an issue is assigned. Auto-watches assignee, notifies them.
 */
export async function notifyIssueAssigned(opts: {
  tenantId: string;
  slug: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
  assigneeId: string;
  actorId: string;
  actorLabel: string | null;
}): Promise<void> {
  if (opts.assigneeId === opts.actorId) return;
  const supabase = createSupabaseServiceClient();
  await issueWatchersRepo(supabase).watch(opts.tenantId, opts.issueId, opts.assigneeId);
  const linkPath = `/${opts.slug}/issues/${opts.issueId}`;
  await notificationsRepo(supabase)
    .create({
      tenantId: opts.tenantId,
      userId: opts.assigneeId,
      type: "assigned",
      title: `Assigned to you: ${opts.issueKey} — ${opts.issueTitle}`,
      body: `Assigned by ${opts.actorLabel ?? "someone"}`,
      issueId: opts.issueId,
      linkPath,
    })
    .catch((e) => console.error("issue_assigned notification failed", e));
}
