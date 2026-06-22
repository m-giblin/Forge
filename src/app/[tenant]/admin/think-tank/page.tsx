import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { thinkTankPillsRepo, tenantIdeaTemplatesRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PillManager from "./PillManager";
import TemplateManager from "./TemplateManager";

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

  const supabase = ctx.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const [pills, templates] = await Promise.all([
    thinkTankPillsRepo(supabase).list(ctx.tenant.id),
    tenantIdeaTemplatesRepo(supabase).list(ctx.tenant.id),
  ]);

  const readOnly = !isAdmin || ctx.impersonating;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Think Tank Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Configure AI lenses and idea templates available to your team.
        </p>
      </div>

      <PillManager slug={slug} pills={pills} readOnly={readOnly} />
      <TemplateManager slug={slug} templates={templates} readOnly={readOnly} />
    </div>
  );
}
