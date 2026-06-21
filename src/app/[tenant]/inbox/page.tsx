import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notificationsRepo } from "@/lib/repositories/notifications";
import InboxClient from "./InboxClient";

export default async function InboxPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();
  const notifications = await notificationsRepo(supabase).list(ctx.appUserId, {
    limit: 100,
    includeRead: true,
  });

  return (
    <InboxClient
      slug={slug}
      userId={ctx.appUserId}
      tenantId={ctx.tenant.id}
      initialNotifications={notifications}
    />
  );
}
