import { requireSuperAdmin } from "@/lib/super-admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import AdminsClient from "./AdminsClient";

export default async function AdminsPage() {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  const svc = createSupabaseServiceClient();
  const { data } = await svc
    .from("super_admins")
    .select("user_id, created_at, user:user_id(id, email, name)")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Admins</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Accounts with full platform access. All changes are logged. You cannot revoke your own access.
        </p>
      </div>
      <AdminsClient
        initialAdmins={(data ?? []) as unknown as SuperAdminRow[]}
        currentUserId={sa.appUserId}
      />
    </div>
  );
}

export type SuperAdminRow = {
  user_id: string;
  created_at: string;
  user: { id: string; email: string; name: string | null } | null;
};
