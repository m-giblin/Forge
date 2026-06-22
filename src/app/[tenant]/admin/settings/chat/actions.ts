"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { saveChatWebhook, removeChatWebhook, type ChatProvider } from "@/lib/services/chatNotifications";
import { saveSlackConfig, clearSlackConfig } from "@/lib/services/slack";

async function adminCtx(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");
  return ctx;
}

export async function saveSlackBotAction(
  slug: string,
  config: { botToken: string; signingSecret: string; workspaceId: string }
): Promise<void> {
  const ctx = await adminCtx(slug);
  if (!config.botToken && !config.signingSecret && !config.workspaceId) {
    await clearSlackConfig(ctx.tenant.id);
  } else {
    await saveSlackConfig(ctx.tenant.id, {
      botToken: config.botToken.trim(),
      signingSecret: config.signingSecret.trim(),
      workspaceId: config.workspaceId.trim(),
    });
  }
  revalidatePath(`/${slug}/admin/settings/chat`);
}

export async function saveChatWebhookAction(slug: string, provider: ChatProvider, url: string): Promise<void> {
  const ctx = await adminCtx(slug);
  if (url && !url.startsWith("https://")) throw new Error("URL must start with https://");
  if (url) {
    await saveChatWebhook(ctx.tenant.id, provider, url);
  } else {
    await removeChatWebhook(ctx.tenant.id, provider);
  }
  revalidatePath(`/${slug}/admin/settings/chat`);
}
