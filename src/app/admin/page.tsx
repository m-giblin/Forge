import { listTenants } from "@/lib/services/platform";
import AdminConsole from "./AdminConsole";

export default async function AdminPage() {
  const tenants = await listTenants();
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-white">Tenants</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Every workspace on the platform. Provisioning sends an owner invite link; suspend blocks
        access; delete is permanent.
      </p>
      <AdminConsole tenants={tenants} />
    </main>
  );
}
