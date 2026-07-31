import { redirect, notFound } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getIntakeForm, listIntakeFormFields, listIntakeSubmissions } from "@/lib/services/intakeForms";
import IntakeFormDetail from "./IntakeFormDetail";

export default async function IntakeFormDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; formId: string }>;
}) {
  const { tenant: slug, formId } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  const readOnly = ctx.role === "viewer";

  const form = await getIntakeForm(ctx.tenant.id, formId);
  if (!form) notFound();

  const [fields, submissions] = await Promise.all([
    listIntakeFormFields(form.id),
    listIntakeSubmissions(ctx.tenant.id, form.id),
  ]);

  return (
    <section>
      <IntakeFormDetail
        slug={slug}
        formId={form.id}
        formName={form.name}
        readOnly={readOnly}
        canManageFields={ctx.role === "owner" || ctx.role === "admin"}
        fields={fields.map((f) => ({ id: f.id, label: f.label, type: f.type, options: f.options, required: f.required }))}
        submissions={submissions.map((s) => ({
          id: s.id, summary: s.summary, answers: s.answers, submitterEmail: s.submitter_email,
          status: s.status, convertedIssueId: s.converted_issue_id, createdAt: s.created_at,
        }))}
      />
    </section>
  );
}
