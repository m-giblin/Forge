import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationsRepo } from "@/lib/repositories/notifications";
import { membersRepo } from "@/lib/repositories/members";
import { getSetting } from "@/lib/platformSettings";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "Forge-Worx <noreply@forge-worx.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

const DEFAULT_NOTIFY_DAYS = 30;
const DEFAULT_GRACE_DAYS = 60;

/** The two super-admin-configurable thresholds — platform_settings, defaults if unset. */
export async function getSdkSuspensionWindows(): Promise<{ notifyDays: number; graceDays: number }> {
  const [notify, grace] = await Promise.all([
    getSetting("sdk_suspension_notify_days"),
    getSetting("sdk_suspension_grace_days"),
  ]);
  const notifyDays = notify ? parseInt(notify, 10) : DEFAULT_NOTIFY_DAYS;
  const graceDays = grace ? parseInt(grace, 10) : DEFAULT_GRACE_DAYS;
  return {
    notifyDays: Number.isFinite(notifyDays) && notifyDays > 0 ? notifyDays : DEFAULT_NOTIFY_DAYS,
    graceDays: Number.isFinite(graceDays) && graceDays > 0 ? graceDays : DEFAULT_GRACE_DAYS,
  };
}

export type FallbackReason =
  | { kind: "inactive_project"; projectKey: string; projectStatus: string }
  | { kind: "suspended_full_alert"; daysSinceSuspended: number }
  | { kind: "suspended_warning"; daysSinceSuspended: number; graceDays: number };

function reasonNote(reason: FallbackReason): string {
  switch (reason.kind) {
    case "inactive_project":
      return `⚠️ Originally targeted project "${reason.projectKey}" (status: ${reason.projectStatus}) — automatically routed here so it wouldn't be missed.`;
    case "suspended_full_alert":
      return `⚠️ This workspace has been suspended for ${reason.daysSinceSuspended} day(s). Routed here automatically — reactivate the workspace to resume normal issue intake.`;
    case "suspended_warning": {
      const daysLeft = Math.max(0, reason.graceDays - reason.daysSinceSuspended);
      return `⚠️ This workspace has been suspended for ${reason.daysSinceSuspended} day(s). SDK issue intake will stop accepting new reports in ${daysLeft} day(s) unless the workspace is reactivated.`;
    }
  }
}

function reasonSubject(reason: FallbackReason, issueKey: string): string {
  switch (reason.kind) {
    case "inactive_project":
      return `⚠️ ${issueKey} was routed to Unrouted Issues — its target project is inactive`;
    case "suspended_full_alert":
      return `⚠️ ${issueKey} filed while your workspace is suspended`;
    case "suspended_warning":
      return `⚠️ Your workspace is suspended — SDK intake stops soon (${issueKey})`;
  }
}

/** Appends the fallback-routing explanation to an issue description, same pattern the SDK itself uses for session-replay attach notes. */
export function appendFallbackNote(description: string | null, reason: FallbackReason): string {
  return `${description ?? ""}\n\n${reasonNote(reason)}`;
}

/**
 * Fan out an urgent alert to every owner/admin of the tenant: an in-app
 * notification (existing bell, real-time) for each, plus one escalation
 * email to the tenant's billing contact — in-app alone can go unread for
 * days, and this is meant to be seen quickly.
 */
export async function alertAdminsOfFallbackRouting(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    billingEmail: string | null;
    issueId: string;
    issueKey: string;
    reason: FallbackReason;
  }
): Promise<void> {
  const adminIds = await membersRepo(supabase).listAdminUserIds(input.tenantId);
  const notifications = notificationsRepo(supabase);
  const linkPath = `/${input.tenantSlug}/issues/${input.issueId}`;
  const title = `${input.issueKey} was routed to Unrouted Issues`;

  await Promise.all(
    adminIds.map((userId) =>
      notifications.create({
        tenantId: input.tenantId,
        userId,
        type: "sdk_fallback_routed",
        title,
        body: reasonNote(input.reason),
        issueId: input.issueId,
        linkPath,
      })
    )
  );

  // Quieter tier ("suspended_warning" mid-grace-period) still gets an email —
  // that's the one case where staying silent risks the customer never
  // finding out until intake actually stops. See design note in the route.
  if (input.billingEmail) {
    try {
      await resend.emails.send({
        from: FROM,
        to: input.billingEmail,
        subject: reasonSubject(input.reason, input.issueKey),
        html: `
          <p>Hi ${input.tenantName} team,</p>
          <p>${reasonNote(input.reason)}</p>
          <p><a href="${APP_URL}${linkPath}">View the issue</a></p>
        `,
      });
    } catch {
      // Email is best-effort — the in-app notification above already landed.
    }
  }
}
