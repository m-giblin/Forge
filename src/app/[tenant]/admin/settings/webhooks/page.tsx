import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: admin reads webhook config (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { webhooksRepo, WEBHOOK_EVENTS } from "@/lib/repositories/webhooks";
import WebhooksClient from "./WebhooksClient";

export default async function WebhooksPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/admin`);

  const endpoints = await webhooksRepo(createSupabaseServiceClient()).listMetadata(ctx.tenant.id);

  return (
    <div className="pb-8">
      <WebhooksClient slug={slug} endpoints={endpoints} allEvents={[...WEBHOOK_EVENTS]} />
    </div>
  );
}
