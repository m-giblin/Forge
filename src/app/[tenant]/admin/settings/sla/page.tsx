import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: admin page, impersonation-safe read (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { slaPoliciesRepo } from "@/lib/repositories/slaPolicies";
import SlaSettingsClient from "./SlaSettingsClient";

export default async function SlaSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const policies = await slaPoliciesRepo(createSupabaseServiceClient())
    .list(ctx.tenant.id)
    .catch(() => []);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <SlaSettingsClient slug={slug} policies={policies} />
    </div>
  );
}
