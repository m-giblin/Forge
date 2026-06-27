import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin/super-admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getSetting } from "@/lib/platformSettings";
import SupportConsole from "./SupportConsole";

type TenantRow = { id: string; name: string; slug: string };

export default async function SupportPage() {
  if (!(await requireSuperAdmin())) redirect("/");

  const svc = createSupabaseServiceClient();

  const [{ data: ticketsRaw, error: tErr }, { data: tenantsRaw, error: tenErr }, stalledSetting] =
    await Promise.all([
      svc
        .from("support_tickets")
        .select(
          "id, tenant_id, submitted_by, actor_label, title, body, status, priority, ticket_type, ai_triage_summary, ai_guidance, platform_notes, created_at, updated_at, resolved_at"
        )
        .eq("ticket_type", "platform")
        .order("created_at", { ascending: false }),
      svc.from("tenants").select("id, name, slug"),
      getSetting("support_stalled_days"),
    ]);

  if (tErr) throw tErr;
  if (tenErr) throw tenErr;

  const tenantMap = new Map<string, TenantRow>(
    (tenantsRaw ?? []).map((t) => [t.id, t as TenantRow])
  );

  const tickets = (ticketsRaw ?? []).map((ticket) => {
    const tenant = tenantMap.get(ticket.tenant_id);
    return {
      ...ticket,
      tenant_name: tenant?.name ?? null,
      tenant_slug: tenant?.slug ?? null,
    };
  });

  const stalledDays = stalledSetting ? parseInt(stalledSetting, 10) : 3;
  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Platform Support Queue</h1>
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
      <SupportConsole tickets={tickets} stalledDays={stalledDays} />
    </main>
  );
}
