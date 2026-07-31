import "server-only";
import { createHash, randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- public submission/resolution has no session; must bypass RLS by design (see migration 0118)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  intakeFormsRepo, intakeFormFieldsRepo, intakeSubmissionsRepo,
  type IntakeForm, type IntakeFormField, type IntakeSubmission,
} from "@/lib/repositories/intakeForms";
import { createIssue } from "@/lib/services/issues";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const MAX_FIELDS_PER_FORM = 20;

export async function listIntakeForms(tenantId: string): Promise<IntakeForm[]> {
  const supabase = await createSupabaseServerClient();
  return intakeFormsRepo(supabase).listForTenant(tenantId);
}

export async function getIntakeForm(tenantId: string, id: string): Promise<IntakeForm | null> {
  const supabase = await createSupabaseServerClient();
  return intakeFormsRepo(supabase).get(tenantId, id);
}

export async function listIntakeFormFields(formId: string): Promise<IntakeFormField[]> {
  const supabase = await createSupabaseServerClient();
  return intakeFormFieldsRepo(supabase).listForForm(formId);
}

/** Creates the form — returns the raw token once; only its hash is ever stored. */
export async function createIntakeForm(tenantId: string, createdBy: string, name: string, description: string, projectId: string): Promise<{ id: string; rawToken: string }> {
  if (!name.trim()) throw new Error("Name is required.");
  const supabase = await createSupabaseServerClient();
  const rawToken = randomBytes(32).toString("hex");
  const form = await intakeFormsRepo(supabase).create({
    tenant_id: tenantId, project_id: projectId, name: name.trim(), description: description.trim() || null,
    token_hash: hashToken(rawToken), created_by: createdBy,
  });
  return { id: form.id, rawToken };
}

export async function regenerateIntakeFormLink(tenantId: string, id: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const rawToken = randomBytes(32).toString("hex");
  await intakeFormsRepo(supabase).regenerateToken(tenantId, id, hashToken(rawToken));
  return rawToken;
}

export async function setIntakeFormActive(tenantId: string, id: string, isActive: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await intakeFormsRepo(supabase).setActive(tenantId, id, isActive);
}

export async function deleteIntakeForm(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await intakeFormsRepo(supabase).remove(tenantId, id);
}

export async function addIntakeFormField(
  tenantId: string, formId: string, input: { label: string; type: "text" | "textarea" | "select"; options: string[]; required: boolean }
): Promise<void> {
  if (!input.label.trim()) throw new Error("Label is required.");
  const supabase = await createSupabaseServerClient();
  const repo = intakeFormFieldsRepo(supabase);
  const existing = await repo.listForForm(formId);
  if (existing.length >= MAX_FIELDS_PER_FORM) throw new Error(`Forms are limited to ${MAX_FIELDS_PER_FORM} fields.`);
  await repo.add({
    tenant_id: tenantId, form_id: formId, label: input.label.trim(), type: input.type,
    options: input.type === "select" ? input.options.filter((o) => o.trim()) : [], required: input.required, position: existing.length,
  });
}

export async function deleteIntakeFormField(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await intakeFormFieldsRepo(supabase).remove(tenantId, id);
}

export async function listIntakeSubmissions(tenantId: string, formId: string): Promise<IntakeSubmission[]> {
  const supabase = await createSupabaseServerClient();
  return intakeSubmissionsRepo(supabase).listForForm(tenantId, formId);
}

export async function dismissIntakeSubmission(tenantId: string, id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await intakeSubmissionsRepo(supabase).markDismissed(tenantId, id);
}

/** Converts a submission into a real issue in the form's target project, formatting the field answers into the description. */
export async function convertIntakeSubmission(tenantId: string, submissionId: string, reporterId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const subRepo = intakeSubmissionsRepo(supabase);
  const submission = await subRepo.get(tenantId, submissionId);
  if (!submission) throw new Error("Submission not found.");
  if (submission.status === "converted") throw new Error("Already converted.");

  const form = await intakeFormsRepo(supabase).get(tenantId, submission.form_id);
  if (!form) throw new Error("Form not found.");
  const fields = await intakeFormFieldsRepo(supabase).listForForm(form.id);

  const lines = fields
    .map((f) => ({ label: f.label, answer: submission.answers[f.id] }))
    .filter((l) => l.answer)
    .map((l) => `**${l.label}:** ${l.answer}`);
  if (submission.submitter_email) lines.push(`**Submitted by:** ${submission.submitter_email}`);
  lines.push(`_Submitted via intake form "${form.name}"._`);

  const issue = await createIssue({
    tenantId, projectId: form.project_id, title: submission.summary, description: lines.join("\n\n"), reporterId,
  });
  await subRepo.markConverted(tenantId, submissionId, issue.id);
  return issue.id;
}

// ── Public path — service-role only, scoped entirely by the validated token ──

export async function resolveIntakeForm(rawToken: string): Promise<{ form: IntakeForm; fields: IntakeFormField[] } | null> {
  if (!rawToken) return null;
  const svc = createSupabaseServiceClient();
  const form = await intakeFormsRepo(svc).resolveByTokenHash(hashToken(rawToken));
  if (!form) return null;
  const fields = await intakeFormFieldsRepo(svc).listForForm(form.id);
  return { form, fields };
}

/** Anonymous submission — rate-limited per IP, since this is a genuinely public write endpoint. */
export async function submitIntake(
  rawToken: string, summary: string, answers: Record<string, string>, submitterEmail: string | null, clientIp: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rl = getRateLimiter();
  const ipResult = await rl.check(`intake:ip:${clientIp}`, 10, 60 * 60_000);
  if (!ipResult.allowed) return { ok: false, error: "Too many submissions — try again later." };

  if (!summary.trim()) return { ok: false, error: "Summary is required." };

  const svc = createSupabaseServiceClient();
  const form = await intakeFormsRepo(svc).resolveByTokenHash(hashToken(rawToken));
  if (!form) return { ok: false, error: "This form is no longer accepting submissions." };

  const fields = await intakeFormFieldsRepo(svc).listForForm(form.id);
  for (const f of fields) {
    if (f.required && !answers[f.id]?.trim()) return { ok: false, error: `"${f.label}" is required.` };
  }

  await intakeSubmissionsRepo(svc).create({
    tenant_id: form.tenant_id, form_id: form.id, summary: summary.trim(), answers, submitter_email: submitterEmail?.trim() || null,
  });
  return { ok: true };
}
