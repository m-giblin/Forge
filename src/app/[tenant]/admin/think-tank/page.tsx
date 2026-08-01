import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { thinkTankPillsRepo, tenantIdeaTemplatesRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select + tenant_settings read (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PillManager from "./PillManager";
import TemplateManager from "./TemplateManager";
import BlindVotingToggle from "./BlindVotingToggle";
import PageHeader from "@/components/patterns/PageHeader";

export default async function ThinkTankAdminPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && !ctx.impersonating) redirect(`/${slug}/board`);

  const svc = createSupabaseServiceClient();
  const supabase = ctx.impersonating
    ? svc
    : await createSupabaseServerClient();

  const [pills, templates, blindRow] = await Promise.all([
    thinkTankPillsRepo(supabase).list(ctx.tenant.id),
    tenantIdeaTemplatesRepo(supabase).list(ctx.tenant.id),
    svc.from("tenant_settings").select("value").eq("tenant_id", ctx.tenant.id).eq("key", "tt_blind_voting").maybeSingle(),
  ]);
  if (blindRow.error) console.error("[admin/think-tank] failed to read tt_blind_voting setting", blindRow.error);

  const readOnly = !isAdmin || ctx.impersonating;
  const blindVoting = blindRow.data?.value === "true";

  return (
    <div>
      <PageHeader title="Think Tank Settings" subtitle="How ideas are captured and voted on" />

      <div className="space-y-6 px-6 py-5">
        {!readOnly && <BlindVotingToggle slug={slug} enabled={blindVoting} />}

        <PillManager slug={slug} pills={pills} readOnly={readOnly} />
        <TemplateManager slug={slug} templates={templates} readOnly={readOnly} />
      </div>
    </div>
  );
}
