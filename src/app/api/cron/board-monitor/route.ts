import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- service-role: cron runs outside user JWT context (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { runBoardMonitor } from "@/lib/services/boardMonitor";
import { getChatWebhooks } from "@/lib/services/chatNotifications";
import { verifyCronAuth } from "@/lib/api/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function sendHealthDigestToSlack(tenantId: string, tenantSlug: string, digest: Awaited<ReturnType<typeof runBoardMonitor>>) {
  const webhooks = await getChatWebhooks(tenantId).catch(() => null);
  if (!webhooks?.slack) return;

  const criticals = digest.alerts.filter((a) => a.level === "critical");
  const warnings = digest.alerts.filter((a) => a.level === "warning");

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🔍 Forge Board Health — Daily Scan", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Open Issues*\n${digest.total_open}` },
        { type: "mrkdwn", text: `*Critical Alerts*\n${digest.critical_count}` },
        { type: "mrkdwn", text: `*Warnings*\n${digest.warning_count}` },
      ],
    },
  ];

  if (criticals.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🚨 *Critical*\n${criticals.map((a) => `• ${a.title}`).join("\n")}`,
      },
    });
  }

  if (warnings.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *Warnings*\n${warnings.map((a) => `• ${a.title}`).join("\n")}`,
      },
    });
  }

  if (digest.ai_digest) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*AI Assessment*\n${digest.ai_digest}` },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Open Mission Control" },
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${tenantSlug}/admin`,
      },
    ],
  });

  await fetch(webhooks.slack, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
}

async function handler(req: Request) {
  if (!verifyCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createSupabaseServiceClient();
  const { data: tenants } = await svc
    .from("tenants")
    .select("id, slug")
    .eq("status", "active");

  const results: Record<string, string> = {};

  for (const tenant of tenants ?? []) {
    const id = tenant.id as string;
    const slug = tenant.slug as string;
    try {
      const digest = await runBoardMonitor(id);
      await sendHealthDigestToSlack(id, slug, digest);
      results[id] = `ok — ${digest.critical_count} critical, ${digest.warning_count} warning`;
    } catch (e) {
      results[id] = `error: ${String(e)}`;
    }
  }

  return NextResponse.json({ scanned: Object.keys(results).length, results });
}

export { handler as GET, handler as POST };
