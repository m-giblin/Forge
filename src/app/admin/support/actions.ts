"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ticketCommentsRepo, type TicketComment } from "@/lib/repositories/ticketComments";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { setSetting } from "@/lib/platformSettings";

export async function updateTicketStatusAction(ticketId: string, status: string): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();

  // Fetch ticket first (need tenant_id + submitted_by for notification + type check)
  const { data: ticket } = await svc
    .from("support_tickets")
    .select("tenant_id, submitted_by, title")
    .eq("id", ticketId)
    .single();

  const { error } = await svc
    .from("support_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    })
    .eq("id", ticketId);
  if (error) throw error;

  // Notify submitter
  if (ticket?.submitted_by) {
    try {
      const statusLabel: Record<string, string> = {
        open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
      };
      await notificationsRepo(svc).create({
        tenantId: ticket.tenant_id,
        userId: ticket.submitted_by,
        type: "support_ticket_status",
        title: `Platform ticket ${statusLabel[status] ?? status}`,
        body: `Your platform ticket "${ticket.title}" has been marked as ${statusLabel[status] ?? status}.`,
        linkPath: "/admin/support",
      });
    } catch {
      // non-fatal
    }
  }

  revalidatePath("/admin/support");
}

export async function updatePlatformNotesAction(ticketId: string, notes: string): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("support_tickets")
    .update({ platform_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) throw error;
  revalidatePath("/admin/support");
}

/** Platform admin adds a reply/note to a platform ticket. */
export async function addPlatformCommentAction(
  ticketId: string,
  body: string,
  isInternal = false
): Promise<{ ok: boolean; error?: string }> {
  const sa = await requireSuperAdmin();
  if (!sa) return { ok: false, error: "Forbidden" };
  if (!body.trim()) return { ok: false, error: "Comment cannot be empty." };

  const svc = createSupabaseServiceClient();

  const { data: ticket } = await svc
    .from("support_tickets")
    .select("id, tenant_id, submitted_by, title")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { ok: false, error: "Ticket not found." };

  // Get super admin's display name/email for the label
  const { data: saUser } = await svc
    .from("super_admins")
    .select("display_name, user:user_id(email, name)")
    .eq("user_id", sa.appUserId)
    .single();
  const label =
    (saUser?.display_name as string | null) ??
    ((saUser?.user as { name?: string | null; email?: string } | null)?.name) ??
    ((saUser?.user as { name?: string | null; email?: string } | null)?.email) ??
    "Forge Support";

  await ticketCommentsRepo(svc).create({
    ticket_id: ticketId,
    tenant_id: ticket.tenant_id,
    author_id: sa.appUserId,
    author_label: label,
    body: body.trim(),
    is_internal: isInternal,
  });

  await svc.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  // Notify submitter of public reply
  if (!isInternal && ticket.submitted_by) {
    try {
      await notificationsRepo(svc).create({
        tenantId: ticket.tenant_id,
        userId: ticket.submitted_by,
        type: "support_ticket_reply",
        title: "Reply from Forge team",
        body: `The Forge team replied to your ticket: "${ticket.title}"`,
        linkPath: `/${ticket.tenant_id}/admin/support`,
      });
    } catch {
      // non-fatal — tenant slug not available here, link is approximate
    }
  }

  revalidatePath("/admin/support");
  return { ok: true };
}

/** Load full comment thread for a platform ticket. */
export async function loadPlatformTicketCommentsAction(ticketId: string): Promise<TicketComment[]> {
  if (!(await requireSuperAdmin())) return [];
  const svc = createSupabaseServiceClient();
  return ticketCommentsRepo(svc).listByTicket(ticketId, true);
}

/** Save the platform-wide stalled threshold. */
export async function savePlatformStalledThresholdAction(days: number): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const clamped = Math.max(1, Math.min(30, Math.round(days)));
  await setSetting("support_stalled_days", String(clamped));
  revalidatePath("/admin/support");
}
