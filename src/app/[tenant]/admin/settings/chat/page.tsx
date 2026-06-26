import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChatWebhooks } from "@/lib/services/chatNotifications";
import { getSlackConfig } from "@/lib/services/slack";
import ChatSettingsClient from "./ChatSettingsClient";

export default async function ChatSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const [webhooks, slackBot] = await Promise.all([
    getChatWebhooks(ctx.tenant.id).catch(() => ({ slack: "", teams: "", discord: "" })),
    getSlackConfig(ctx.tenant.id).catch(() => null),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <ChatSettingsClient
        slug={slug}
        webhooks={webhooks}
        slackBot={{
          botToken: slackBot?.botToken ?? "",
          signingSecret: slackBot?.signingSecret ?? "",
          workspaceId: slackBot?.workspaceId ?? "",
        }}
      />
    </div>
  );
}
