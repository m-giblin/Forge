import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminSidebar from "./AdminSidebar";
import PlatformTopBar from "./PlatformTopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();

  // Platform-admin MFA used to be hardcoded mandatory (no exceptions, since
  // this account has cross-tenant power, unlike the per-tenant require_mfa
  // toggle in [tenant]/layout.tsx). Turned into a real feature flag —
  // `platform_mfa_required` in platform_settings, same on/off mechanism as
  // the Admin → Feature Access kill switches — so it can be switched back on
  // later without a code change. Defaults OFF (missing row = not required).
  const [{ data: mfaSetting }, { count: openTickets }, { count: tenantCount }] = await Promise.all([
    svc.from("platform_settings").select("value").eq("key", "platform_mfa_required").maybeSingle(),
    svc.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    svc.from("tenants").select("id", { count: "exact", head: true }),
  ]);
  if (mfaSetting?.value === "true") {
    const supabaseForMfa = await createSupabaseServerClient();
    const { data: aal } = await supabaseForMfa.auth.mfa.getAuthenticatorAssuranceLevel();
    if ((aal?.currentLevel ?? "aal1") !== "aal2") {
      redirect(`/mfa-required?next=${encodeURIComponent("/admin")}`);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "var(--font-inter), -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <AdminSidebar openTickets={openTickets ?? 0} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minWidth: 0 }}>
        <PlatformTopBar tenantCount={tenantCount ?? 0} />
        {children}
      </div>
    </div>
  );
}
