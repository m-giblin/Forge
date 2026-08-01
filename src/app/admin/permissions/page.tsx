import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { permissionDefinitionsRepo } from "@/lib/repositories/permissionDefinitions";
import PageHeader from "@/components/patterns/PageHeader";
import PermissionsConsole from "./PermissionsConsole";

export default async function AdminPermissionsPage() {
  if (!(await requireSuperAdmin())) redirect("/");

  const svc = createSupabaseServiceClient();
  const permissions = await permissionDefinitionsRepo(svc).listAll();

  return (
    <main className="px-6 py-5">
      <Link href="/admin" className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#c9791d] hover:underline">
        ← Dashboard
      </Link>
      <PageHeader
        title="Permission Registry"
        subtitle="The catalog every workspace's custom-role editor reads from. Add a permission here when a new feature area needs its own access control — no deploy required."
      />

      <div className="mt-4 space-y-4">
        <p className="text-[12px] text-[#726e60]">
          The server action or route that actually enforces it still has to call{" "}
          <code className="rounded bg-[#f4ead4] px-1 py-0.5 font-mono text-[11px] text-[#5a4a2f]">
            ctxCanDo(ctx, &quot;your_key&quot;)
          </code>{" "}
          in code; this page only manages the catalog, defaults, and labels around that call.
        </p>

        <PermissionsConsole initial={permissions} />
      </div>
    </main>
  );
}
