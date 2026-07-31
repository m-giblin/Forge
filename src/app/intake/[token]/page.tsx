import { resolveIntakeForm } from "@/lib/services/intakeForms";
import IntakeFormClient from "./IntakeFormClient";

export const dynamic = "force-dynamic";

export default async function PublicIntakeFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveIntakeForm(token);

  if (!resolved) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-neutral-900">Form not found</p>
          <p className="mt-1 text-sm text-neutral-500">This link is invalid or the form is no longer accepting submissions.</p>
        </div>
      </main>
    );
  }

  return (
    <IntakeFormClient
      token={token}
      formName={resolved.form.name}
      formDescription={resolved.form.description}
      fields={resolved.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, options: f.options, required: f.required }))}
    />
  );
}
