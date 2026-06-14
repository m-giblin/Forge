"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/auth";
import {
  addFieldOption, deleteFieldOption, setDefaultOption, addCategory, deleteCategory,
  addCustomField, deleteCustomField,
} from "@/lib/services/fieldConfig";
import { recordAudit } from "@/lib/audit";
import type { FieldName, CustomFieldType } from "@/lib/repositories/fieldConfig";

async function admin(slug: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) throw new Error("Not authorized");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins manage fields.");
  return ctx;
}

export async function addOptionAction(slug: string, field: FieldName, label: string) {
  const ctx = await admin(slug);
  await addFieldOption(ctx.tenant.id, field, label);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "field.add", target: `${field}:${label}` });
  revalidatePath(`/${slug}/admin/fields`);
}

export async function deleteOptionAction(slug: string, id: string) {
  const ctx = await admin(slug);
  await deleteFieldOption(ctx.tenant.id, id);
  revalidatePath(`/${slug}/admin/fields`);
}

export async function setDefaultAction(slug: string, id: string, field: FieldName) {
  const ctx = await admin(slug);
  await setDefaultOption(ctx.tenant.id, id, field);
  revalidatePath(`/${slug}/admin/fields`);
}

export async function addCategoryAction(slug: string, name: string, parentId: string | null) {
  const ctx = await admin(slug);
  await addCategory(ctx.tenant.id, name, parentId);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "category.add", target: name });
  revalidatePath(`/${slug}/admin/fields`);
}

export async function deleteCategoryAction(slug: string, id: string) {
  const ctx = await admin(slug);
  await deleteCategory(ctx.tenant.id, id);
  revalidatePath(`/${slug}/admin/fields`);
}

export async function addCustomFieldAction(
  slug: string,
  input: { label: string; type: CustomFieldType; options: string[]; required: boolean }
) {
  const ctx = await admin(slug);
  await addCustomField(ctx.tenant.id, input);
  await recordAudit({ tenantId: ctx.tenant.id, actorUserId: ctx.appUserId, action: "customfield.add", target: `${input.type}:${input.label}` });
  revalidatePath(`/${slug}/admin/fields`);
}

export async function deleteCustomFieldAction(slug: string, id: string) {
  const ctx = await admin(slug);
  await deleteCustomField(ctx.tenant.id, id);
  revalidatePath(`/${slug}/admin/fields`);
}
