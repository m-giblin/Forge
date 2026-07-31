"use server";

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { setSetting } from "@/lib/platformSettings";
import { setTenantSetting } from "@/lib/tenantSettings";

export async function saveNotificationSettingsAction(
  slug: string,
  form: {
    resendApiKey: string;
    emailDisplayName: string;
    emailPrimaryColor: string;
    emailFromName: string;
    standupEmailRecipients: string;
  }
) {
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Admin access required.");

  const tenantId = ctx.tenant.id;

  await Promise.all([
    setSetting("resend_api_key", form.resendApiKey.trim()),
    setTenantSetting(tenantId, "email_display_name", form.emailDisplayName.trim()),
    setTenantSetting(tenantId, "email_primary_color", form.emailPrimaryColor.trim()),
    setTenantSetting(tenantId, "email_from_name", form.emailFromName.trim()),
    setTenantSetting(tenantId, "standup_email_recipients", form.standupEmailRecipients.trim()),
  ]);
}
