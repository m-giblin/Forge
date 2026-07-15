"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { supportTicketsRepo } from "@/lib/repositories/supportTickets";
import { ticketCommentsRepo, type TicketComment } from "@/lib/repositories/ticketComments";
import { triageSupportTicket } from "@/lib/services/supportTriage";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { setTenantSetting } from "@/lib/tenantSettings";

/** Tenant admin updates the status of an internal ticket — notifies submitter. */
export async function updateInternalTicketStatusAction(
  slug: string,
  ticketId: string,
  status: string
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Forbidden");

  const svc = createSupabaseServiceClient();
  await supportTicketsRepo(svc).updateStatus(ctx.tenant.id, ticketId, status as "open" | "in_progress" | "resolved" | "closed");

  // Notify submitter
  try {
    const { data: ticket } = await svc
      .from("support_tickets")
      .select("submitted_by, title")
      .eq("id", ticketId)
      .eq("tenant_id", ctx.tenant.id)
      .single();
    if (ticket?.submitted_by) {
      const statusLabel: Record<string, string> = {
        open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
      };
      await notificationsRepo(svc).create({
        tenantId: ctx.tenant.id,
        userId: ticket.submitted_by,
        type: "support_ticket_status",
        title: `Support ticket ${statusLabel[status] ?? status}`,
        body: `Your request "${ticket.title}" has been marked as ${statusLabel[status] ?? status}.`,
        linkPath: `/${slug}/support`,
      });
    }
  } catch {
    // non-fatal
  }

  revalidatePath(`/${slug}/admin/support`);
}

/** Tenant admin adds a comment/reply to an internal ticket. */
export async function addAdminCommentAction(
  slug: string,
  ticketId: string,
  body: string,
  isInternal = false
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") return { ok: false, error: "Forbidden" };

  if (!body.trim()) return { ok: false, error: "Comment cannot be empty." };

  const svc = createSupabaseServiceClient();

  const { data: ticket } = await svc
    .from("support_tickets")
    .select("id, tenant_id, submitted_by, title")
    .eq("id", ticketId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!ticket) return { ok: false, error: "Ticket not found." };

  await ticketCommentsRepo(svc).create({
    ticket_id: ticketId,
    tenant_id: ctx.tenant.id,
    author_id: ctx.appUserId,
    author_label: ctx.email ?? "Admin",
    body: body.trim(),
    is_internal: isInternal,
  });

  await svc.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  // Notify submitter of public reply
  if (!isInternal && ticket.submitted_by && ticket.submitted_by !== ctx.appUserId) {
    try {
      await notificationsRepo(svc).create({
        tenantId: ctx.tenant.id,
        userId: ticket.submitted_by,
        type: "support_ticket_reply",
        title: "Reply on your support request",
        body: `Your team admin replied to "${ticket.title}"`,
        linkPath: `/${slug}/support`,
      });
    } catch {
      // non-fatal
    }
  }

  revalidatePath(`/${slug}/admin/support`);
  return { ok: true };
}

/** Tenant admin loads full comment thread (including internal notes). */
export async function loadAdminTicketCommentsAction(
  slug: string,
  ticketId: string
): Promise<TicketComment[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return [];
  if (ctx.role !== "owner" && ctx.role !== "admin") return [];

  const svc = createSupabaseServiceClient();
  return ticketCommentsRepo(svc).listByTicket(ticketId, true, ctx.tenant.id); // include internal, scoped to caller's tenant
}

/** Admin submits a platform ticket to the Forge team. */
export async function submitPlatformTicketAction(
  slug: string,
  formData: { title: string; body: string; priority: string }
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") return { ok: false, error: "Forbidden" };

  const svc = createSupabaseServiceClient();
  const repo = supportTicketsRepo(svc);

  const ticket = await repo.create({
    tenant_id: ctx.tenant.id,
    submitted_by: ctx.appUserId,
    actor_label: ctx.email ?? undefined,
    title: formData.title,
    body: formData.body,
    priority: formData.priority as "low" | "medium" | "high" | "urgent",
    ticket_type: "platform",
  });

  // AI triage — non-fatal
  try {
    const triage = await triageSupportTicket({
      tenantId: ctx.tenant.id,
      title: ticket.title,
      body: ticket.body,
      tenantName: ctx.tenant.name,
    });
    await repo.updateTriage(ctx.tenant.id, ticket.id, {
      ai_triage_summary: triage.summary,
      ai_guidance: triage.guidance,
    });
  } catch {
    // non-fatal
  }

  // Notify submitter with receipt
  try {
    if (ctx.appUserId) {
      await notificationsRepo(svc).create({
        tenantId: ctx.tenant.id,
        userId: ctx.appUserId,
        type: "support_ticket_received",
        title: "Platform ticket submitted",
        body: "Your request has been sent to the Forge team and AI-triaged.",
        linkPath: `/${slug}/admin/support`,
      });
    }
  } catch {
    // non-fatal
  }

  revalidatePath(`/${slug}/admin/support`);
  return { ok: true };
}

/** Save the stalled ticket threshold for this tenant (in days). */
export async function saveTenantStalledThresholdAction(
  slug: string,
  days: number
): Promise<void> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Forbidden");

  const clamped = Math.max(1, Math.min(30, Math.round(days)));
  await setTenantSetting(ctx.tenant.id, "support_stalled_days", String(clamped));
  revalidatePath(`/${slug}/admin/support`);
}
