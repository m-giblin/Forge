"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import {
  createIntakeForm, regenerateIntakeFormLink, setIntakeFormActive, deleteIntakeForm,
  addIntakeFormField, deleteIntakeFormField, dismissIntakeSubmission, convertIntakeSubmission,
} from "@/lib/services/intakeForms";
import { recordAudit } from "@/lib/audit";

async function admin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins manage intake forms.");
  return ctx;
}

async function member(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role === "viewer") throw new Error("Viewers can't review submissions.");
  return ctx;
}

/** Returns the new form's id + the full shareable URL — the raw token is never stored, so this is the only time the caller can see the link. */
export async function createIntakeFormAction(slug: string, name: string, description: string, projectId: string): Promise<{ id: string; url: string }> {
  const ctx = await admin(slug);
  const { id, rawToken } = await createIntakeForm(ctx.tenant.id, ctx.appUserId, name, description, projectId);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "intakeform.create", target: name });
  revalidatePath(`/${slug}/admin/intake-forms`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  return { id, url: `${baseUrl}/intake/${rawToken}` };
}

export async function regenerateIntakeFormLinkAction(slug: string, formId: string): Promise<string> {
  const ctx = await admin(slug);
  const rawToken = await regenerateIntakeFormLink(ctx.tenant.id, formId);
  revalidatePath(`/${slug}/admin/intake-forms`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  return `${baseUrl}/intake/${rawToken}`;
}

export async function setIntakeFormActiveAction(slug: string, formId: string, isActive: boolean) {
  const ctx = await admin(slug);
  await setIntakeFormActive(ctx.tenant.id, formId, isActive);
  revalidatePath(`/${slug}/admin/intake-forms`);
}

export async function deleteIntakeFormAction(slug: string, formId: string) {
  const ctx = await admin(slug);
  await deleteIntakeForm(ctx.tenant.id, formId);
  revalidatePath(`/${slug}/admin/intake-forms`);
}

export async function addIntakeFormFieldAction(
  slug: string, formId: string, input: { label: string; type: "text" | "textarea" | "select"; options: string[]; required: boolean }
) {
  const ctx = await admin(slug);
  await addIntakeFormField(ctx.tenant.id, formId, input);
  revalidatePath(`/${slug}/admin/intake-forms/${formId}`);
}

export async function deleteIntakeFormFieldAction(slug: string, formId: string, fieldId: string) {
  const ctx = await admin(slug);
  await deleteIntakeFormField(ctx.tenant.id, fieldId);
  revalidatePath(`/${slug}/admin/intake-forms/${formId}`);
}

export async function convertIntakeSubmissionAction(slug: string, formId: string, submissionId: string): Promise<string> {
  const ctx = await member(slug);
  const issueId = await convertIntakeSubmission(ctx.tenant.id, submissionId, ctx.appUserId);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "intakeform.convert", target: submissionId });
  revalidatePath(`/${slug}/admin/intake-forms/${formId}`);
  return issueId;
}

export async function dismissIntakeSubmissionAction(slug: string, formId: string, submissionId: string) {
  const ctx = await member(slug);
  await dismissIntakeSubmission(ctx.tenant.id, submissionId);
  revalidatePath(`/${slug}/admin/intake-forms/${formId}`);
}
