import { requireSuperAdmin } from "@/lib/super-admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
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
  user: { id: string; email: string; name: string | null } | null;
};

export default async function AdminsPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("super_admins")
    .select("user_id, created_at, updated_at, display_name, phone, cell, alt_email, notes, user:user_id(id, email, name)")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Admins</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Accounts with full platform access. Click any row to view or edit their profile.
        </p>
      </div>
      <AdminsClient
        initialAdmins={(data ?? []) as unknown as SuperAdminRow[]}
        currentUserId={sa.appUserId}
      />
    </div>
  );
}
