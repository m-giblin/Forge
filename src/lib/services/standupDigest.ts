/**
 * Standup Digest — daily AI-generated team brief.
 * Answers: what shipped, what's in progress, what's blocked, what needs attention.
 * Stored as platform_config key `standup_digest_latest`.
 * Sent to configured chat webhooks + email if configured.
 */
import "server-only";
// eslint-disable-next-line no-restricted-imports -- service-role: cron runs outside user JWT
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { grokComplete } from "@/lib/services/grokAi";

export interface StandupEntry {
  section: "shipped" | "in_progress" | "blocked" | "needs_triage";
  items: string[];
}

export interface StandupDigest {
  generated_at: string;
  date_label: string;
  entries: StandupEntry[];
  ai_summary: string | null;
  stats: {
    shipped_today: number;
    in_progress: number;
    blocked: number;
    unassigned: number;
  };
}

export async function generateStandupDigest(tenantId: string): Promise<StandupDigest> {
  const svc = createSupabaseServiceClient();

  const since = new Date();
  since.setHours(since.getHours() - 24);

  // Fetch recently completed issues (done in last 24h)
  const [{ data: recentDone }, { data: openIssues }, { data: projects }] = await Promise.all([
    svc
      .from("issues")
      .select("key, title, assignee_id, status, updated_at, project_id")
      .eq("tenant_id", tenantId)
      .eq("status", "done")
      .gte("updated_at", since.toISOString())
      .order("updated_at", { ascending: false })
      .limit(20),
    svc
      .from("issues")
      .select("key, title, assignee_id, status, priority, updated_at, project_id")
      .eq("tenant_id", tenantId)
      .not("status", "in", '("done","closed")')
      .order("updated_at", { ascending: false })
      .limit(100),
    svc
      .from("projects")
      .select("id, key, name")
      .eq("tenant_id", tenantId),
  ]);

  const projectMap = new Map((projects ?? []).map((p) => [p.id as string, p.key as string]));

  const inProgress = (openIssues ?? []).filter((i) => i.status === "in_progress" || i.status === "in_review");
  const blocked = (openIssues ?? []).filter((i) => i.status === "blocked");
  const unassigned = (openIssues ?? []).filter((i) => !i.assignee_id);
  const needsTriage = (openIssues ?? []).filter(
    (i) => i.status === "todo" && !i.assignee_id && (i.priority === "urgent" || i.priority === "high")
  );

  const entries: StandupEntry[] = [];

  if ((recentDone ?? []).length > 0) {
    entries.push({
      section: "shipped",
      items: (recentDone ?? []).map((i) => `${i.key}: ${i.title}`),
    });
  }

  if (inProgress.length > 0) {
    entries.push({
      section: "in_progress",
      items: inProgress.slice(0, 10).map((i) => `${i.key}: ${i.title}`),
    });
  }

  if (blocked.length > 0) {
    entries.push({
      section: "blocked",
      items: blocked.map((i) => `${i.key}: ${i.title}`),
    });
  }

  if (needsTriage.length > 0) {
    entries.push({
      section: "needs_triage",
      items: needsTriage.slice(0, 8).map((i) => `${i.key} [${i.priority}]: ${i.title}`),
    });
  }

  const stats = {
    shipped_today: (recentDone ?? []).length,
    in_progress: inProgress.length,
    blocked: blocked.length,
    unassigned: unassigned.length,
  };

  const ai_summary = await generateAISummary(tenantId, entries, stats);
  const now = new Date();

  const digest: StandupDigest = {
    generated_at: now.toISOString(),
    date_label: now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    entries,
    ai_summary,
    stats,
  };

  await svc.from("platform_config").upsert(
    { tenant_id: tenantId, key: "standup_digest_latest", value: JSON.stringify(digest) },
    { onConflict: "tenant_id,key" }
  );

  return digest;
}

async function generateAISummary(tenantId: string, entries: StandupEntry[], stats: ReturnType<typeof Object.assign>): Promise<string | null> {
  const body = entries.map((e) => `${e.section.toUpperCase()}:\n${e.items.join("\n")}`).join("\n\n");
  const statsLine = `Stats: ${stats.shipped_today} shipped today, ${stats.in_progress} in progress, ${stats.blocked} blocked, ${stats.unassigned} unassigned.`;

  const system = `You are a scrum master writing a concise daily standup summary for an engineering team. Be direct, practical, and brief. Use plain text, no markdown headers. Max 100 words.`;
  const user = `${statsLine}\n\n${body}\n\nWrite a 2-3 sentence summary covering: what the team accomplished, current focus, and any blockers or risks that need immediate attention.`;

  try {
    return await grokComplete(tenantId, [{ role: "system", content: system }, { role: "user", content: user }], {
      temperature: 0.3, maxTokens: 200, feature: "standup_digest",
    });
  } catch {
    return null;
  }
}

export async function sendStandupToSlack(tenantId: string, tenantSlug: string, digest: StandupDigest): Promise<void> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "chat_webhook_slack")
    .maybeSingle();

  const slackUrl = data?.value as string | null;
  if (!slackUrl) return;

  const sectionEmojis: Record<string, string> = {
    shipped: "✅",
    in_progress: "🔄",
    blocked: "🚨",
    needs_triage: "⚠️",
  };
  const sectionLabels: Record<string, string> = {
    shipped: "Shipped",
    in_progress: "In Progress",
    blocked: "Blocked",
    needs_triage: "Needs Triage",
  };

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📋 Daily Standup — ${digest.date_label}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Shipped*\n${digest.stats.shipped_today}` },
        { type: "mrkdwn", text: `*In Progress*\n${digest.stats.in_progress}` },
        { type: "mrkdwn", text: `*Blocked*\n${digest.stats.blocked}` },
        { type: "mrkdwn", text: `*Unassigned*\n${digest.stats.unassigned}` },
      ],
    },
  ];

  for (const entry of digest.entries) {
    const emoji = sectionEmojis[entry.section] ?? "•";
    const label = sectionLabels[entry.section] ?? entry.section;
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${label}*\n${entry.items.slice(0, 5).map((i) => `• ${i}`).join("\n")}${entry.items.length > 5 ? `\n_+${entry.items.length - 5} more_` : ""}`,
      },
    });
  }

  if (digest.ai_summary) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `_${digest.ai_summary}_` },
    });
  }

  blocks.push({
    type: "actions",
    elements: [{
      type: "button",
      text: { type: "plain_text", text: "Open Board" },
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${tenantSlug}/board`,
    }],
  });

  await fetch(slackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
}

export async function sendStandupEmail(tenantId: string, tenantSlug: string, digest: StandupDigest): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const svc = createSupabaseServiceClient();

  // Get configured digest email list from platform_config
  const { data: cfgRow } = await svc
    .from("platform_config")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "standup_email_recipients")
    .maybeSingle();

  const recipientsRaw = cfgRow?.value as string | null;
  if (!recipientsRaw) return;
  const recipients = recipientsRaw.split(",").map((e) => e.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  const { data: tenantRow } = await svc.from("tenants").select("name").eq("id", tenantId).single();
  const tenantName = tenantRow?.name ?? "Your Workspace";

  const LABELS: Record<string, string> = { shipped: "✅ Shipped", in_progress: "🔄 In Progress", blocked: "🚨 Blocked", needs_triage: "⚠️ Needs Triage" };
  const sectionsHtml = digest.entries
    .filter((e) => e.items.length > 0)
    .map((e) => `
      <div style="margin-bottom:16px">
        <p style="margin:0 0 6px;font-weight:600;font-size:14px;color:#374151">${LABELS[e.section] ?? e.section}</p>
        <ul style="margin:0;padding-left:20px;color:#4b5563;font-size:13px;line-height:1.6">
          ${e.items.map((i) => `<li>${i}</li>`).join("")}
        </ul>
      </div>
    `).join("");

  const statsHtml = `
    <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
      ${[
        { label: "Shipped", val: digest.stats.shipped_today, color: "#059669" },
        { label: "In Progress", val: digest.stats.in_progress, color: "#2563eb" },
        { label: "Blocked", val: digest.stats.blocked, color: "#dc2626" },
        { label: "Unassigned", val: digest.stats.unassigned, color: "#9ca3af" },
      ].map((s) => `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px;min-width:80px">
        <p style="margin:0;font-size:20px;font-weight:700;color:${s.color}">${s.val}</p>
        <p style="margin:0;font-size:11px;color:#6b7280">${s.label}</p>
      </div>`).join("")}
    </div>
  `;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em">Daily Standup</p>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700">${tenantName}</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280">${digest.date_label}</p>
      ${statsHtml}
      ${digest.ai_summary ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:20px"><p style="margin:0;font-size:13px;color:#1e40af">${digest.ai_summary}</p></div>` : ""}
      ${sectionsHtml}
      <p style="margin-top:24px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px">
        You're receiving this because you're subscribed to standup digests for ${tenantName} on Forge.
        <a href="https://forge.app/${tenantSlug}/admin" style="color:#6b7280">Manage preferences</a>
      </p>
    </div>
  `;

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);
  await resend.emails.send({
    from: `${tenantName} <digest@mail.useforge.dev>`,
    to: recipients,
    subject: `📋 Standup Digest — ${digest.date_label} | ${tenantName}`,
    html,
  }).catch(() => null);
}

export async function getLatestStandupDigest(tenantId: string): Promise<StandupDigest | null> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", "standup_digest_latest")
    .maybeSingle();

  if (!data?.value) return null;
  try {
    return JSON.parse(data.value as string) as StandupDigest;
  } catch {
    return null;
  }
}
