import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChatWebhooks } from "@/lib/services/chatNotifications";
import ChatSettingsClient from "./ChatSettingsClient";

export default async function ChatSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const webhooks = await getChatWebhooks(ctx.tenant.id).catch(() => ({ slack: "", teams: "", discord: "" }));

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <ChatSettingsClient slug={slug} webhooks={webhooks} />
    </div>
  );
}
