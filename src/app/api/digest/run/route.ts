import { NextRequest } from "next/server";
import { Resend } from "resend";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/** GET /api/digest/run — send weekly digest emails to opted-in users.
 *  Requires x-cron-secret header matching DIGEST_CRON_SECRET env var.
 *  Safe to call repeatedly; only sends to users with unread notifications from the last 7 days.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.DIGEST_CRON_SECRET;
  if (!secret) {
    return new Response("DIGEST_CRON_SECRET not configured", { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return new Response("RESEND_API_KEY not configured", { status: 503 });
  }
  const resend = new Resend(resendKey);
  const supabase = createSupabaseServiceClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

  // Users who have opted in (email_digest = true or column doesn't exist yet → default true).
  // We join notifications to avoid emailing users with nothing to report.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, email, name")
    .or("email_digest.is.null,email_digest.eq.true");

  if (usersErr) {
    logger.error("digest: failed to load users", { error: usersErr.message });
    return new Response("DB error", { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const user of users ?? []) {
    const { data: notifs, error: notifErr } = await supabase
      .from("notifications")
      .select("id, tenant_id, type, title, body, link_path, created_at")
      .eq("user_id", user.id)
      .is("read_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    if (notifErr || !notifs || notifs.length === 0) {
      skipped++;
      continue;
    }

    const rows = notifs
      .map((n) => {
        const link = n.link_path ? `${baseUrl}${n.link_path}` : baseUrl;
        return `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <a href="${link}" style="color:#111827;font-weight:600;text-decoration:none">${escapeHtml(n.title)}</a>
            ${n.body ? `<div style="color:#6b7280;font-size:13px;margin-top:2px">${escapeHtml(n.body)}</div>` : ""}
          </td>
        </tr>`;
      })
      .join("");

    const name = user.name || user.email;
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 0">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px">
  <div style="margin-bottom:24px">
    <span style="background:#111827;color:#fff;font-size:13px;font-weight:700;padding:4px 10px;border-radius:6px">Forge</span>
  </div>
  <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Your weekly digest</h2>
  <p style="margin:0 0 24px;color:#6b7280;font-size:14px">Hi ${escapeHtml(name)}, here's what happened while you were away.</p>
  <table style="width:100%;border-collapse:collapse">
    ${rows}
  </table>
  <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f0f0f0">
    <a href="${baseUrl}" style="background:#111827;color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">
      Open Forge
    </a>
  </div>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">
    You're receiving this because you have unread notifications in Forge.
    <br>To stop these emails, turn off digest in your account settings.
  </p>
</div>
</body>
</html>`;

    try {
      await resend.emails.send({
        from: "Forge <notifications@forge.app>",
        to: user.email,
        subject: `Forge digest — ${notifs.length} unread notification${notifs.length === 1 ? "" : "s"}`,
        html,
      });
      sent++;
    } catch (e) {
      logger.error("digest: send failed", { userId: user.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
