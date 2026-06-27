import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { supportTicketsRepo } from "@/lib/repositories/supportTickets";
import { getTenantSetting } from "@/lib/tenantSettings";
import SupportPage from "./SupportPage";

export default async function AdminSupportPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();

  const [tickets, stalledDaysSetting] = await Promise.all([
    supportTicketsRepo(svc).listByTenant(ctx.tenant.id, "internal"),
    getTenantSetting(ctx.tenant.id, "support_stalled_days"),
  ]);

  const stalledDays = stalledDaysSetting ? parseInt(stalledDaysSetting, 10) : 3;

  return (
    <SupportPage
      tickets={tickets}
      slug={slug}
      stalledDays={stalledDays}
    />
  );
}
