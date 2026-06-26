"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { supportTicketsRepo } from "@/lib/repositories/supportTickets";
import { triageSupportTicket } from "@/lib/services/supportTriage";
import { notificationsRepo } from "@/lib/repositories/notifications";

export async function submitTicketAction(
  slug: string,
  formData: { title: string; body: string; priority: string }
): Promise<{ ok: boolean; ticketId?: string }> {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const repo = supportTicketsRepo(svc);

  // Create the ticket
  const ticket = await repo.create({
    tenant_id: ctx.tenant.id,
    submitted_by: ctx.appUserId,
    actor_label: ctx.email ?? undefined,
    title: formData.title,
    body: formData.body,
    priority: formData.priority as "low" | "medium" | "high" | "urgent",
  });

  // AI triage — fire and update; failure is non-fatal
  try {
    const triage = await triageSupportTicket({
      title: ticket.title,
      body: ticket.body,
      tenantName: ctx.tenant.name,
    });
    await repo.updateTriage(ctx.tenant.id, ticket.id, {
      ai_triage_summary: triage.summary,
      ai_guidance: triage.guidance,
    });
  } catch {
    // triage failed — ticket is still saved, just without AI summary
  }

  // Notify the submitter
  try {
    if (ctx.appUserId) {
      await notificationsRepo(svc).create({
        tenantId: ctx.tenant.id,
        userId: ctx.appUserId,
        type: "support_ticket_triaged",
        title: "Support ticket triaged",
        body: "Your support ticket has been triaged by AI. View guidance in Admin → Get Support.",
        linkPath: `/${slug}/admin/support`,
      });
    }
  } catch {
    // notification failure is non-fatal
  }

  revalidatePath(`/${slug}/admin/support`);
  return { ok: true, ticketId: ticket.id };
}
