import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getTenantSchema } from "@/lib/services/fieldConfig";
import FieldsManager from "./FieldsManager";

export default async function FieldsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Fields & categories</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Customize the statuses, priorities, types, and categories used by issues in this workspace.
      </p>
      <FieldsManager slug={slug} schema={await getTenantSchema(ctx.tenant.id, ctx.impersonating)} readOnly={readOnly} />
    </section>
  );
}
