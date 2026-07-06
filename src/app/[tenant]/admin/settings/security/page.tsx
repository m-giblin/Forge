import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getIpAllowlist } from "@/lib/services/ipAllowlist";
// eslint-disable-next-line no-restricted-imports -- admin settings: service-role needed for tenant_settings read (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SecuritySettingsClient from "./SecuritySettingsClient";

const SETTING_KEY = "session_timeout_minutes";
const DEFAULT_MINUTES = 30;

export default async function SecuritySettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/${slug}`);

  const supabase = await createSupabaseServerClient();
  const svc = createSupabaseServiceClient();

  const [mfaResult, ipEntries, sessionResult] = await Promise.all([
    supabase.from("tenants").select("require_mfa").eq("id", ctx.tenant.id).single(),
    getIpAllowlist(ctx.tenant.id),
    svc
      .from("tenant_settings")
      .select("value")
      .eq("tenant_id", ctx.tenant.id)
      .eq("key", SETTING_KEY)
      .maybeSingle(),
  ]);

  const requireMfa = mfaResult.data?.require_mfa ?? false;
  const rawMinutes = sessionResult.data?.value ? parseInt(sessionResult.data.value, 10) : DEFAULT_MINUTES;
  const sessionMinutes = isNaN(rawMinutes) ? DEFAULT_MINUTES : rawMinutes;

  return (
    <SecuritySettingsClient
      slug={slug}
      initialRequireMfa={requireMfa}
      initialIpEntries={ipEntries}
      initialSessionMinutes={sessionMinutes}
    />
  );
}
