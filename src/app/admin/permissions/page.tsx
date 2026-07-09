import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { permissionDefinitionsRepo } from "@/lib/repositories/permissionDefinitions";
import { adminStyles as S } from "../page";
import PermissionsConsole from "./PermissionsConsole";

export default async function AdminPermissionsPage() {
  if (!(await requireSuperAdmin())) redirect("/");

  const svc = createSupabaseServiceClient();
  const permissions = await permissionDefinitionsRepo(svc).listAll();

  return (
    <main style={{ padding: "24px 28px", maxWidth: 1000 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Permission Registry</h1>
        <p style={S.pageSub}>
          The catalog every workspace&apos;s custom-role editor reads from. Add a permission here when a new
          feature area needs its own access control — no deploy required. The server action or route that
          actually enforces it still has to call <code>ctxCanDo(ctx, &quot;your_key&quot;)</code> in code; this
          page only manages the catalog, defaults, and labels around that call.
        </p>
      </div>
      <PermissionsConsole initial={permissions} />
    </main>
  );
}
