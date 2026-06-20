import { getTenantContext } from "@/lib/auth";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- service-role: admin page loads rules (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { automationRulesRepo } from "@/lib/repositories/automationRules";
import AutomationsClient from "./AutomationsClient";

export default async function AutomationsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect(`/${slug}/auth/login`);
  if (!["owner", "admin"].includes(ctx.role)) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const rules = await automationRulesRepo(svc).list(ctx.tenant.id).catch(() => []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <AutomationsClient slug={slug} rules={rules} />
    </div>
  );
}
