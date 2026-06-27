import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- service-role: member page, tenant context verified (sec09)
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
  // All members can access — no role gate

  const svc = createSupabaseServiceClient();
  // Show only this member's own internal tickets
  const tickets = await supportTicketsRepo(svc).listBySubmitter(
    ctx.tenant.id,
    ctx.appUserId,
    "internal"
  );

  return <SupportPage tickets={tickets} slug={slug} />;
}
