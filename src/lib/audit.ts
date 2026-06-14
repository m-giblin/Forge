import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Append an audit entry. Writes go through the service-role client because
 * audit_log has no insert RLS policy (it's append-only from trusted server
 * code). Call AFTER the underlying authorized action succeeds.
 */
export async function recordAudit(entry: {
  tenantId: string | null;
  actorUserId: string | null;
  actorLabel?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("audit_log").insert({
    tenant_id: entry.tenantId,
    actor_user_id: entry.actorUserId,
    actor_label: entry.actorLabel ?? null,
    action: entry.action,
    target: entry.target ?? null,
    metadata: entry.metadata ?? {},
  });
  // Auditing must never break the user action; log and move on.
  if (error) console.error("audit write failed:", error.message, entry.action);
}

export type AuditEntry = {
  id: string;
  tenant_id: string | null;
  actor_label: string | null;
  action: string;
  target: string | null;
  created_at: string;
};
