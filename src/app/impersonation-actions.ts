"use server";

import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/super-admin";
import { setImpersonationCookie, clearImpersonationCookie, readImpersonation } from "@/lib/impersonation";
import { recordAudit } from "@/lib/audit";

const TTL_MS = 30 * 60 * 1000;

/** Super admin enters a read-only support view of a tenant. */
export async function startImpersonationAction(tenantId: string, slug: string) {
  const sa = await requireSuperAdmin();
  if (!sa) throw new Error("Forbidden");

  await setImpersonationCookie({ tenantId, tenantSlug: slug, exp: Date.now() + TTL_MS, by: sa.appUserId });
  await recordAudit({
    tenantId,
    actorUserId: sa.appUserId,
    actorLabel: sa.email,
    action: "impersonation.start",
    target: slug,
  });
  redirect(`/${slug}/board`);
}

/** Exit the support view. */
export async function stopImpersonationAction() {
  const imp = await readImpersonation();
  const sa = await requireSuperAdmin();
  await clearImpersonationCookie();
  if (imp && sa) {
    await recordAudit({
      tenantId: imp.tenantId,
      actorUserId: sa.appUserId,
      actorLabel: sa.email,
      action: "impersonation.stop",
      target: imp.tenantSlug,
    });
  }
  redirect("/admin");
}
