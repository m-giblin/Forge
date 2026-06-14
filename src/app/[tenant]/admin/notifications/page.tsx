import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getSetting } from "@/lib/platformSettings";
import { getTenantSettings } from "@/lib/tenantSettings";
import NotificationsForm from "./NotificationsForm";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}/admin`);

  const [storedKey, tenantBranding] = await Promise.all([
    getSetting("resend_api_key"),
    getTenantSettings(ctx.tenant.id, ["email_display_name", "email_primary_color", "email_from_name"]),
  ]);

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Notifications</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Configure email notifications and branding for your workspace.
      </p>
      <NotificationsForm
        slug={slug}
        initial={{
          resendApiKey: storedKey || process.env.RESEND_API_KEY || "",
          emailDisplayName: tenantBranding["email_display_name"] || ctx.tenant.name,
          emailPrimaryColor: tenantBranding["email_primary_color"] || "#111827",
          emailFromName: tenantBranding["email_from_name"] || `${ctx.tenant.name} via Forge`,
        }}
      />
    </section>
  );
}
