import "server-only";
import { Resend } from "resend";
import { getSetting } from "@/lib/platformSettings";
import { getTenantSettings } from "@/lib/tenantSettings";
import { buildAssignmentEmail, type OpenTicket } from "@/lib/emailTemplate";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { notificationsRepo } from "@/lib/repositories/notifications";

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
