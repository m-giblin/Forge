"use server";

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { setSetting } from "@/lib/platformSettings";
import { setTenantSetting } from "@/lib/tenantSettings";
// eslint-disable-next-line no-restricted-imports -- service-role needed to upsert platform_config
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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

  const svc = createSupabaseServiceClient();
  await Promise.all([
    setSetting("resend_api_key", form.resendApiKey.trim()),
    setTenantSetting(tenantId, "email_display_name", form.emailDisplayName.trim()),
    setTenantSetting(tenantId, "email_primary_color", form.emailPrimaryColor.trim()),
    setTenantSetting(tenantId, "email_from_name", form.emailFromName.trim()),
    svc.from("platform_config").upsert(
      { tenant_id: tenantId, key: "standup_email_recipients", value: form.standupEmailRecipients.trim() },
      { onConflict: "tenant_id,key" }
    ),
  ]);
}
