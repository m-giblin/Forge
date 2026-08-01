import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getTenantSchema } from "@/lib/services/fieldConfig";
import { listIssueTemplates } from "@/lib/services/issueTemplates";
// eslint-disable-next-line no-restricted-imports -- admin page needs project list (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import PageHeader from "@/components/patterns/PageHeader";
import FieldsManager from "./FieldsManager";
import CategoryImporter from "./CategoryImporter";

export default async function FieldsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = !(ctx.role === "owner" || ctx.role === "admin");

  const svc = createSupabaseServiceClient();
  const [projects, schema, templates] = await Promise.all([
    projectsRepo(svc).listByTenant(ctx.tenant.id),
    getTenantSchema(ctx.tenant.id, ctx.impersonating),
    listIssueTemplates(ctx.tenant.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Fields & Labels" subtitle="Categories, components, custom fields and issue templates" />
      <div className="space-y-4 px-6">
        <FieldsManager slug={slug} schema={schema} templates={templates} readOnly={readOnly} />
        {!readOnly && (
          <div>
            <h2 className="mb-1 text-[12.5px] font-bold text-[#20201d]">Bulk import categories</h2>
            <p className="mb-3 text-[11.5px] text-[#726e60]">Upload a CSV to populate categories for a specific project. Select the project, upload your file, preview the tree, then confirm.</p>
            <CategoryImporter
              slug={slug}
              projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
