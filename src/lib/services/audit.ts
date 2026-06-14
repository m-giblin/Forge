import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireSuperAdmin } from "@/lib/super-admin";
import { platformRepo, type AuditRawRow } from "@/lib/repositories/platform";

export type AuditView = {
  id: string;
  tenant_id: string | null;
  action: string;
  target: string | null;
  actor: string | null; // resolved email or stored label
  created_at: string;
};

function actorEmail(row: AuditRawRow): string | null {
  if (row.actor_label) return row.actor_label;
  const a = Array.isArray(row.actor) ? row.actor[0] : row.actor;
  return a?.email ?? null;
}

function toView(r: AuditRawRow): AuditView {
  return { id: r.id, tenant_id: r.tenant_id, action: r.action, target: r.target, created_at: r.created_at, actor: actorEmail(r) };
}

/** A tenant's audit entries. `impersonating` → service-role (super-admin support view). */
export async function listTenantAudit(tenantId: string, impersonating = false): Promise<AuditView[]> {
  const supabase = impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  const rows = await platformRepo(supabase).listAuditByTenant(tenantId);
  return rows.map(toView);
}

/** All audit entries across the platform (super admin only). */
export async function listPlatformAudit(): Promise<AuditView[]> {
  if (!(await requireSuperAdmin())) throw new Error("Forbidden");
  const svc = createSupabaseServiceClient();
  const rows = await platformRepo(svc).listAuditAll();
  return rows.map(toView);
}
