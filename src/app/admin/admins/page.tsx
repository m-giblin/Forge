import { requireSuperAdmin } from "@/lib/super-admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminsClient from "./AdminsClient";

export type SuperAdminRow = {
  user_id: string;
  created_at: string;
  updated_at: string | null;
  display_name: string | null;
  phone: string | null;
  cell: string | null;
  alt_email: string | null;
  notes: string | null;
  user: { id: string; email: string; name: string | null; auth_id: string | null } | null;
};

export default async function AdminsPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();

  const { data } = await svc
    .from("super_admins")
    .select("user_id, created_at, updated_at, display_name, phone, cell, alt_email, notes, user:user_id(id, email, name, auth_id)")
    .order("created_at", { ascending: true });

  const admins = (data ?? []) as unknown as SuperAdminRow[];

  // Fetch last_sign_in_at for each admin from auth.users (service role only)
  const lastLoginMap: Record<string, string | null> = {};
  await Promise.all(
    admins.map(async (a) => {
      const authId = a.user?.auth_id;
      if (!authId) return;
      const { data: au } = await svc.auth.admin.getUserById(authId);
      lastLoginMap[a.user_id] = au?.user?.last_sign_in_at ?? null;
    })
  );

  const S = {
    backLink: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280", textDecoration: "none", fontWeight: 500, marginBottom: 18 } as React.CSSProperties,
    pageTitle: { fontSize: 18, fontWeight: 800, color: "#111827" } as React.CSSProperties,
    pageSub:   { fontSize: 12, color: "#6b7280", marginTop: 4 } as React.CSSProperties,
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Platform Admins</h1>
        <p style={S.pageSub}>
          Accounts with full platform access. Click any row to view or edit their profile.
        </p>
      </div>
      <AdminsClient
        initialAdmins={admins}
        currentUserId={sa.appUserId}
        lastLoginMap={lastLoginMap}
      />
    </div>
  );
}
