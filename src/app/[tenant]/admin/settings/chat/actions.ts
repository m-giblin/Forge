"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import { saveChatWebhook, removeChatWebhook, type ChatProvider } from "@/lib/services/chatNotifications";

async function adminCtx(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Admins only");
  return ctx;
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
