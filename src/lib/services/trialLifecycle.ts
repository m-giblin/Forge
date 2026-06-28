import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "Forge-Worx <noreply@forge-worx.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

type EmailType = "day_3_nudge" | "day_7_midpoint" | "day_13_urgency" | "expired";

interface TrialingTenant {
  id: string;
  name: string;
  slug: string;
  billing_email: string | null;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_status: string;
}

// ─── Email HTML builders ───────────────────────────────────────────────────

function buildTrialEmail(
  type: EmailType,
  tenant: TrialingTenant,
  daysLeft: number,
): { subject: string; html: string } {
  const dashUrl = `${APP_URL}/${tenant.slug}/board`;
  const billingUrl = `${APP_URL}/${tenant.slug}/billing`;
  const upgradeUrl = billingUrl;

  const urgencyColor = daysLeft <= 1 ? "#dc2626" : daysLeft <= 3 ? "#ea580c" : "#4f46e5";

  const configs: Record<EmailType, { subject: string; headline: string; body: string; cta: string; ctaUrl: string }> = {
    day_3_nudge: {
      subject: `${tenant.name}: your Forge-Worx trial is going well — here's what you're unlocking`,
      headline: "You're 3 days in. Here's what most teams discover next.",
      body: `Your team's sprint data is already flowing. The next thing most PMs explore is <strong>Cycle Time Analytics</strong> — it shows you exactly where work stalls (by priority, type, and assignee), so retros fix real problems instead of vibes.<br><br>You have <strong>${daysLeft} days left</strong> on your Premium trial. Make the most of it.`,
      cta: "Explore Cycle Time Analytics →",
      ctaUrl: `${APP_URL}/${tenant.slug}/reports/cycle-time`,
    },
    day_7_midpoint: {
      subject: `${tenant.name}: halfway through your trial — are you getting the reports you need?`,
      headline: "7 days in. Your stakeholders should already be impressed.",
      body: `At the halfway mark, teams that get the most from Forge-Worx have already run a sprint, pulled a burndown report, and sent a stakeholder update without a single manually-built slide.<br><br>If you haven't tried the <strong>Custom Report Builder</strong> yet, now's the time. 9 dimensions, 3 metrics, 5 chart types — build exactly the report your CTO asks for, then save it.<br><br><strong>${daysLeft} days remaining</strong> on your Premium trial.`,
      cta: "Open the Report Builder →",
      ctaUrl: `${APP_URL}/${tenant.slug}/reports/custom`,
    },
    day_13_urgency: {
      subject: `${tenant.name}: your Forge-Worx Premium trial ends tomorrow`,
      headline: "Your trial ends tomorrow.",
      body: `You've had 13 days with full Premium access — cycle time analytics, stakeholder reports, custom builder, scheduled reports, and AI intelligence.<br><br>Tomorrow, your workspace moves to Basic automatically. <strong>None of your data is lost</strong>, but the analytics you've been using will be locked.<br><br>Upgrade now to keep everything you've built, without missing a beat.`,
      cta: "Upgrade to keep Premium →",
      ctaUrl: upgradeUrl,
    },
    expired: {
      subject: `${tenant.name}: your Forge-Worx trial has ended`,
      headline: "Your trial has ended.",
      body: `Your 14-day Premium trial for <strong>${tenant.name}</strong> has ended. Your workspace is now on the Basic plan.<br><br>All your issues, sprints, and history are safe. To unlock Cycle Time Analytics, Stakeholder Reports, the Custom Builder, and Scheduled Reports again, upgrade to Premium.<br><br>It takes about 60 seconds.`,
      cta: "Upgrade to Premium →",
      ctaUrl: upgradeUrl,
    },
  };

  const c = configs[type];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-size:17px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
              Forge<span style="color:#818cf8;">-Worx</span>
            </span>
          </td>
          <td align="right">
            <span style="font-size:12px;color:rgba(255,255,255,0.5);">
              ${tenant.name}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:32px 28px 24px;">
      ${daysLeft > 0 ? `
      <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="background:${urgencyColor}1a;border:1px solid ${urgencyColor}33;border-radius:8px;padding:10px 16px;">
            <span style="font-size:13px;font-weight:700;color:${urgencyColor};">
              ⏰ ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left on your Premium trial
            </span>
          </td>
        </tr>
      </table>` : ""}

      <h2 style="margin:0 0 14px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;">
        ${c.headline}
      </h2>

      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
        ${c.body}
      </p>

      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td>
            <a href="${c.ctaUrl}"
               style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;letter-spacing:0.02em;">
              ${c.cta}
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#94a3b8;">
        Or go to your dashboard: <a href="${dashUrl}" style="color:#4f46e5;">${dashUrl}</a>
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:16px 28px;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">
        You received this because your Forge-Worx workspace <strong>${tenant.name}</strong> is on a Premium trial.
        To manage billing, visit <a href="${billingUrl}" style="color:#64748b;">your billing page</a>.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: c.subject, html };
}

// ─── Core functions ────────────────────────────────────────────────────────

async function hasEmailBeenSent(tenantId: string, emailType: EmailType): Promise<boolean> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("trial_lifecycle_emails")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email_type", emailType)
    .maybeSingle();
  return !!data;
}

async function recordEmailSent(tenantId: string, emailType: EmailType, recipientEmail: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc.from("trial_lifecycle_emails").upsert(
    { tenant_id: tenantId, email_type: emailType, recipient_email: recipientEmail },
    { onConflict: "tenant_id,email_type" }
  );
}

async function sendTrialEmail(tenant: TrialingTenant, type: EmailType, daysLeft: number): Promise<void> {
  const to = tenant.billing_email;
  if (!to) return;

  if (await hasEmailBeenSent(tenant.id, type)) return;

  const { subject, html } = buildTrialEmail(type, tenant, daysLeft);

  await resend.emails.send({ from: FROM, to, subject, html });
  await recordEmailSent(tenant.id, type, to);
}

// ─── Main cron function ────────────────────────────────────────────────────

export async function runTrialLifecycle(): Promise<{ processed: number; emails: number; expired: number }> {
  const svc = createSupabaseServiceClient();
  const now = new Date();

  // Fetch all trialing or recently-expired tenants
  const { data: tenants, error } = await svc
    .from("tenants")
    .select("id, name, slug, billing_email, trial_started_at, trial_ends_at, subscription_status")
    .in("subscription_status", ["trialing", "active"])
    .not("trial_ends_at", "is", null);

  if (error) throw new Error(`Failed to fetch tenants: ${error.message}`);

  let emailsSent = 0;
  let expired = 0;

  for (const tenant of (tenants ?? []) as TrialingTenant[]) {
    const endsAt = new Date(tenant.trial_ends_at);
    const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysUsed = Math.floor((now.getTime() - new Date(tenant.trial_started_at).getTime()) / (1000 * 60 * 60 * 24));

    // Auto-expire
    if (daysLeft <= 0 && tenant.subscription_status === "trialing") {
      await svc
        .from("tenants")
        .update({
          subscription_status: "expired",
          subscription_tier: "basic",
          plan: "basic",
        })
        .eq("id", tenant.id);
      expired++;

      // Send expiry email
      try {
        await sendTrialEmail(tenant, "expired", 0);
        emailsSent++;
      } catch (e) {
        console.error(`[trial] expiry email failed for ${tenant.slug}:`, e);
      }
      continue;
    }

    if (tenant.subscription_status !== "trialing") continue;

    // Lifecycle nudge emails
    const emailsToCheck: Array<{ type: EmailType; dayMin: number; dayMax: number; daysLeft: number }> = [
      { type: "day_3_nudge",    dayMin: 3, dayMax: 4,  daysLeft: Math.max(0, 14 - daysUsed) },
      { type: "day_7_midpoint", dayMin: 7, dayMax: 8,  daysLeft: Math.max(0, 14 - daysUsed) },
      { type: "day_13_urgency", dayMin: 0, dayMax: 2,  daysLeft },
    ];

    for (const nudge of emailsToCheck) {
      // day_3 and day_7 trigger on days elapsed; day_13 triggers on days remaining
      const shouldSend =
        nudge.type === "day_13_urgency"
          ? daysLeft >= nudge.dayMin && daysLeft <= nudge.dayMax
          : daysUsed >= nudge.dayMin && daysUsed < nudge.dayMax;

      if (shouldSend) {
        try {
          await sendTrialEmail(tenant, nudge.type, nudge.daysLeft);
          emailsSent++;
        } catch (e) {
          console.error(`[trial] ${nudge.type} email failed for ${tenant.slug}:`, e);
        }
      }
    }
  }

  return { processed: (tenants ?? []).length, emails: emailsSent, expired };
}
