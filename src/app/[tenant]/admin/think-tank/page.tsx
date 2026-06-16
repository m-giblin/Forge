import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { thinkTankPillsRepo, tenantIdeaTemplatesRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    <div className="space-y-10">
      <div>
        <h2 className="mb-1 text-base font-semibold text-neutral-900">Think Tank Settings</h2>
        <p className="mb-6 text-sm text-neutral-500">
          Manage the AI Sounding Board lenses available to your team. Custom lenses appear after the built-in defaults.
        </p>
        <PillManager slug={slug} pills={pills} readOnly={readOnly} />
      </div>

      <hr className="border-neutral-100" />

      <TemplateManager slug={slug} templates={templates} readOnly={readOnly} />
    </div>
  );
}
