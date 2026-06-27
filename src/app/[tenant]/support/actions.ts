"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { supportTicketsRepo } from "@/lib/repositories/supportTickets";
import { ticketCommentsRepo, type TicketComment } from "@/lib/repositories/ticketComments";
import { notificationsRepo } from "@/lib/repositories/notifications";

export type AttachmentInput = {
  name: string;
  type: string;
  size: number;
  data: string; // base64 data URL
};

/** All members can submit internal tickets to their tenant admin. */
export async function submitInternalTicketAction(
  slug: string,
  formData: {
    title: string;
    body: string;
    priority: string;
    attachments?: AttachmentInput[];
  }
): Promise<{ ok: boolean; ticketId?: string; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const svc = createSupabaseServiceClient();
  const repo = supportTicketsRepo(svc);

  const ticket = await repo.create({
    tenant_id: ctx.tenant.id,
    submitted_by: ctx.appUserId,
    actor_label: ctx.email ?? undefined,
    title: formData.title,
    body: formData.body,
    priority: formData.priority as "low" | "medium" | "high" | "urgent",
    ticket_type: "internal",
    attachments: (formData.attachments ?? []).map((a) => ({
      name: a.name,
      type: a.type,
      size: a.size,
      data: a.data,
    })),
  });

  // Notify all tenant admins/owners
  try {
    const { data: admins } = await svc
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", ctx.tenant.id)
      .in("role", ["owner", "admin"]);
    for (const admin of admins ?? []) {
      if (admin.user_id === ctx.appUserId) continue;
      await notificationsRepo(svc).create({
        tenantId: ctx.tenant.id,
        userId: admin.user_id,
        type: "support_ticket_new",
        title: "New support request",
        body: `"${ticket.title}" from ${ctx.email ?? "a team member"}`,
        linkPath: `/${slug}/admin/support`,
      });
    }
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
        title: "Support request submitted",
        body: "Your request has been sent to your team admin. You'll be notified when they reply or update the status.",
        linkPath: `/${slug}/support`,
      });
    }
  } catch {
    // non-fatal
  }

  revalidatePath(`/${slug}/support`);
  return { ok: true, ticketId: ticket.id };
}

/** Submitter adds a reply to their ticket thread. */
export async function addSubmitterCommentAction(
  slug: string,
  ticketId: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  if (!body.trim()) return { ok: false, error: "Reply cannot be empty." };

  const svc = createSupabaseServiceClient();

  const { data: ticket } = await svc
    .from("support_tickets")
    .select("id, tenant_id, submitted_by, ticket_type, title")
    .eq("id", ticketId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!ticket || ticket.submitted_by !== ctx.appUserId) {
    return { ok: false, error: "Ticket not found." };
  }

  await ticketCommentsRepo(svc).create({
    ticket_id: ticketId,
    tenant_id: ctx.tenant.id,
    author_id: ctx.appUserId,
    author_label: ctx.email ?? "You",
    body: body.trim(),
    is_internal: false,
  });

  await svc.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  // Notify tenant admins of the reply (internal tickets)
  if (ticket.ticket_type === "internal") {
    try {
      const { data: admins } = await svc
        .from("memberships")
        .select("user_id")
        .eq("tenant_id", ctx.tenant.id)
        .in("role", ["owner", "admin"]);
      for (const admin of admins ?? []) {
        if (admin.user_id === ctx.appUserId) continue;
        await notificationsRepo(svc).create({
          tenantId: ctx.tenant.id,
          userId: admin.user_id,
          type: "support_ticket_reply",
          title: "Reply on support ticket",
          body: `${ctx.email ?? "A member"} replied to "${ticket.title}"`,
          linkPath: `/${slug}/admin/support`,
        });
      }
    } catch {
      // non-fatal
    }
  }

  revalidatePath(`/${slug}/support`);
  return { ok: true };
}

/** Load public comments for a ticket the submitter owns. */
export async function loadTicketCommentsAction(
  slug: string,
  ticketId: string
): Promise<TicketComment[]> {
  const ctx = await getTenantContext(slug);
  if (!ctx) return [];

  const svc = createSupabaseServiceClient();

  const { data: ticket } = await svc
    .from("support_tickets")
    .select("id, submitted_by, tenant_id")
    .eq("id", ticketId)
    .eq("tenant_id", ctx.tenant.id)
    .single();

  if (!ticket || ticket.submitted_by !== ctx.appUserId) return [];

  return ticketCommentsRepo(svc).listByTicket(ticketId, false);
}
