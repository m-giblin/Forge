import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export type ChatProvider = "slack" | "teams" | "discord";

const PROVIDER_KEYS: Record<ChatProvider, string> = {
  slack: "chat_webhook_slack",
  teams: "chat_webhook_teams",
  discord: "chat_webhook_discord",
};

async function getWebhookUrl(tenantId: string, provider: ChatProvider): Promise<string | null> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", PROVIDER_KEYS[provider])
    .maybeSingle();
  return (data?.value as string) ?? null;
}

export async function saveChatWebhook(tenantId: string, provider: ChatProvider, url: string): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc.from("platform_config").upsert(
    { tenant_id: tenantId, key: PROVIDER_KEYS[provider], value: url },
    { onConflict: "tenant_id,key" },
  );
}

export async function removeChatWebhook(tenantId: string, provider: ChatProvider): Promise<void> {
  const svc = createSupabaseServiceClient();
  await svc.from("platform_config")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("key", PROVIDER_KEYS[provider]);
}

export async function getChatWebhooks(tenantId: string): Promise<Record<ChatProvider, string>> {
  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("platform_config")
    .select("key, value")
    .eq("tenant_id", tenantId)
    .in("key", Object.values(PROVIDER_KEYS));

  const result = { slack: "", teams: "", discord: "" } as Record<ChatProvider, string>;
  for (const row of data ?? []) {
    const provider = (Object.entries(PROVIDER_KEYS).find(([, k]) => k === row.key)?.[0] ?? null) as ChatProvider | null;
    if (provider) result[provider] = (row.value as string) ?? "";
  }
  return result;
}

// --- Payload builders ---

type IssuePayload = {
  issueKey: string;
  issueTitle: string;
  issueUrl: string;
  status?: string;
  priority?: string;
  actorLabel?: string | null;
  event: "created" | "updated" | "commented";
  commentBody?: string;
};

function slackPayload(p: IssuePayload): object {
  const color = { created: "#6366f1", updated: "#f59e0b", commented: "#22c55e" }[p.event];
  const title = p.event === "created"
    ? `🐛 New issue: ${p.issueKey}`
    : p.event === "commented"
    ? `💬 Comment on ${p.issueKey}`
    : `✏️ Updated: ${p.issueKey}`;

  const text = p.event === "commented" && p.commentBody
    ? p.commentBody.slice(0, 300)
    : p.issueTitle;

  return {
    attachments: [{
      color,
      fallback: `${title} — ${p.issueTitle}`,
      title,
      title_link: p.issueUrl,
      text,
      fields: [
        ...(p.status ? [{ title: "Status", value: p.status, short: true }] : []),
        ...(p.priority ? [{ title: "Priority", value: p.priority, short: true }] : []),
        ...(p.actorLabel ? [{ title: "By", value: p.actorLabel, short: true }] : []),
      ],
    }],
  };
}

function teamsPayload(p: IssuePayload): object {
  const title = p.event === "created"
    ? `New issue: ${p.issueKey}`
    : p.event === "commented"
    ? `Comment on ${p.issueKey}`
    : `Updated: ${p.issueKey}`;

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: title,
    themeColor: "6366f1",
    title,
    text: p.issueTitle,
    potentialAction: [{
      "@type": "OpenUri",
      name: "View Issue",
      targets: [{ os: "default", uri: p.issueUrl }],
    }],
    sections: [{
      facts: [
        ...(p.status ? [{ name: "Status", value: p.status }] : []),
        ...(p.priority ? [{ name: "Priority", value: p.priority }] : []),
        ...(p.actorLabel ? [{ name: "By", value: p.actorLabel }] : []),
        ...(p.commentBody ? [{ name: "Comment", value: p.commentBody.slice(0, 300) }] : []),
      ],
    }],
  };
}

function discordPayload(p: IssuePayload): object {
  const color = { created: 0x6366f1, updated: 0xf59e0b, commented: 0x22c55e }[p.event];
  const description = p.event === "commented" && p.commentBody
    ? p.commentBody.slice(0, 300)
    : p.issueTitle;

  return {
    embeds: [{
      color,
      title: `${p.issueKey} — ${p.issueTitle}`,
      url: p.issueUrl,
      description,
      fields: [
        ...(p.status ? [{ name: "Status", value: p.status, inline: true }] : []),
        ...(p.priority ? [{ name: "Priority", value: p.priority, inline: true }] : []),
        ...(p.actorLabel ? [{ name: "By", value: p.actorLabel, inline: true }] : []),
      ],
    }],
  };
}

async function deliverOne(url: string, provider: ChatProvider, body: object): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
}

export async function notifyChat(tenantId: string, payload: IssuePayload): Promise<void> {
  const webhooks = await getChatWebhooks(tenantId).catch(() => null);
  if (!webhooks) return;

  const sends: Promise<void>[] = [];
  const providers: ChatProvider[] = ["slack", "teams", "discord"];

  for (const provider of providers) {
    const url = webhooks[provider];
    if (!url) continue;
    const body = provider === "slack" ? slackPayload(payload)
      : provider === "teams" ? teamsPayload(payload)
      : discordPayload(payload);
    sends.push(
      deliverOne(url, provider, body).catch((e) =>
        logger.warn("Chat notification failed", { tenantId, provider, err: String(e) }),
      ),
    );
  }
  await Promise.allSettled(sends);
}
