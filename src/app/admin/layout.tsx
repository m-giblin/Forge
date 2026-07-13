import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/super-admin";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  // MFA is mandatory for every super admin, no exceptions — this account has
  // cross-tenant power, unlike the per-tenant require_mfa toggle in
  // [tenant]/layout.tsx which is opt-in per workspace.
  const supabaseForMfa = await createSupabaseServerClient();
  const { data: aal } = await supabaseForMfa.auth.mfa.getAuthenticatorAssuranceLevel();
  if ((aal?.currentLevel ?? "aal1") !== "aal2") {
    redirect(`/mfa-required?next=${encodeURIComponent("/admin")}`);
  }

  const svc = createSupabaseServiceClient();
  const { count: openTickets } = await svc
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <AdminSidebar openTickets={openTickets ?? 0} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
