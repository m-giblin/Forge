"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { generateGuestLink, revokeGuestLink } from "@/lib/services/guestLinks";
import { recordAudit } from "@/lib/audit";

async function admin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins manage guest access.");
  return ctx;
}

/** Returns the full shareable URL — the raw token is never stored, so this is the only time the caller can see it. */
export async function generateGuestLinkAction(slug: string, projectId: string): Promise<string> {
  const ctx = await admin(slug);
  const rawToken = await generateGuestLink(ctx.tenant.id, projectId, ctx.appUserId);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "guestlink.generate", target: projectId });
  revalidatePath(`/${slug}/admin/guest-access`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  return `${baseUrl}/shared/project?token=${rawToken}`;
}

export async function revokeGuestLinkAction(slug: string, projectId: string) {
  const ctx = await admin(slug);
  await revokeGuestLink(ctx.tenant.id, projectId);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "guestlink.revoke", target: projectId });
  revalidatePath(`/${slug}/admin/guest-access`);
}
