import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required, tenant context verified by getTenantContext (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { supportTicketsRepo } from "@/lib/repositories/supportTickets";
import SupportPage from "./SupportPage";

export default async function TenantSupportPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const tickets = await supportTicketsRepo(svc).listByTenant(ctx.tenant.id);

  return <SupportPage tickets={tickets} slug={slug} />;
}
