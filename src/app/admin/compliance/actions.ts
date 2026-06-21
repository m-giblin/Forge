"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function createComplianceRequestAction(data: {
  request_type: "deletion" | "export" | "correction";
  requester_email: string;
  tenant_id: string | null;
  regulation: string;
  notes: string;
}): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("compliance_requests").insert({
    request_type: data.request_type,
    requester_email: data.requester_email.trim().toLowerCase(),
    tenant_id: data.tenant_id || null,
    regulation: data.regulation,
    notes: data.notes || null,
    status: "pending",
  });
  if (error) throw error;
  revalidatePath("/admin/compliance");
}

export async function updateComplianceStatusAction(
  id: string,
  status: "pending" | "in_progress" | "completed" | "denied",
  notes?: string
): Promise<void> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("compliance_requests")
    .update({
      status,
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      ...(notes !== undefined ? { notes } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/compliance");
}
