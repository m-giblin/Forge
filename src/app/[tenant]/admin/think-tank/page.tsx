import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { thinkTankPillsRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PillManager from "./PillManager";

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

  const pills = await thinkTankPillsRepo(supabase).list(ctx.tenant.id);

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-neutral-900">Think Tank Settings</h2>
      <p className="mb-6 text-sm text-neutral-500">
        Manage the AI Sounding Board lenses available to your team. Custom lenses appear after the built-in defaults.
      </p>
      <PillManager slug={slug} pills={pills} readOnly={!isAdmin || ctx.impersonating} />
    </div>
  );
}
