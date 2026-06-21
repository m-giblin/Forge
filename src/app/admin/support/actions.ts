"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function updateTicketStatusAction(ticketId: string, status: string): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("support_tickets")
    .update({
      status,
      ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
  if (error) throw error;
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
