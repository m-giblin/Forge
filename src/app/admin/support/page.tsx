import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required, explicit tenant scoping applied (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import SupportConsole from "./SupportConsole";

type RawTicket = {
  id: string;
  tenant_id: string;
  actor_label: string | null;
  title: string;
  body: string;
  status: string;
  priority: string;
  ai_triage_summary: string | null;
  ai_guidance: string | null;
  platform_notes: string | null;
  created_at: string;
};

type TenantRow = { id: string; name: string; slug: string };

export default async function SupportPage() {
  if (!(await requireSuperAdmin())) redirect("/");

  const svc = createSupabaseServiceClient();

  const [{ data: ticketsRaw, error: tErr }, { data: tenantsRaw, error: tenErr }] =
    await Promise.all([
      svc
        .from("support_tickets")
        .select(
          "id, tenant_id, actor_label, title, body, status, priority, ai_triage_summary, ai_guidance, platform_notes, created_at"
        )
        .order("created_at", { ascending: false }),
      svc.from("tenants").select("id, name, slug"),
    ]);

  if (tErr) throw tErr;
  if (tenErr) throw tenErr;

  const tenantMap = new Map<string, TenantRow>(
    (tenantsRaw ?? []).map((t) => [t.id, t as TenantRow])
  );

  const tickets = (ticketsRaw ?? []).map((ticket: RawTicket) => {
    const tenant = tenantMap.get(ticket.tenant_id);
    return {
      ...ticket,
      tenant_name: tenant?.name ?? null,
      tenant_slug: tenant?.slug ?? null,
    };
  });

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Support Queue</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {openCount > 0 ? (
              <span className="text-red-300 font-medium">{openCount} open ticket{openCount !== 1 ? "s" : ""}</span>
            ) : (
              "No open tickets"
            )}
            {" "}· {tickets.length} total
          </p>
        </div>
      </div>
      <SupportConsole tickets={tickets} />
    </main>
  );
}
