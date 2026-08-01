import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getTenantSchema } from "@/lib/services/fieldConfig";
import { listVisibleProjects } from "@/lib/services/projects";
import ImportWizard from "./ImportWizard";
import PageHeader from "@/components/patterns/PageHeader";
import Note from "@/components/patterns/admin/Note";

export default async function ImportPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  const readOnly = !isAdmin || ctx.impersonating;

  const [schema, projects] = await Promise.all([
    getTenantSchema(ctx.tenant.id, ctx.impersonating),
    listVisibleProjects(ctx.tenant.id, ctx.appUserId, ctx.role, ctx.impersonating),
  ]);

  if (readOnly) {
    return (
      <div className="space-y-6">
        <PageHeader title="Import Issues" subtitle="Bring work in from CSV or another tracker" />
        <div className="px-6">
          <Note icon="⚠" tone="warning">
            Import is disabled in read-only / support-view mode.
          </Note>
        </div>
      </div>
    );
  }

  return (
    <ImportWizard
      slug={slug}
      projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
      statuses={schema.statuses}
      priorities={schema.priorities}
      types={schema.types}
      categories={schema.categories}
      customFields={schema.customFields}
    />
  );
}
