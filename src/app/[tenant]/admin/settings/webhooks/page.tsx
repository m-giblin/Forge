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

  const endpoints = await webhooksRepo(createSupabaseServiceClient()).list(ctx.tenant.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Webhooks</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Push issue events to external URLs (Slack, Make, Zapier, your own API). Payloads are signed with HMAC-SHA256.
        </p>
      </div>
      <WebhooksClient slug={slug} endpoints={endpoints} allEvents={[...WEBHOOK_EVENTS]} />
    </div>
  );
}
