import { requireSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getSetting } from "@/lib/platformSettings";
import SupportConsole from "./SupportConsole";
import PageHeader from "@/components/patterns/PageHeader";

type TenantRow = { id: string; name: string; slug: string };

export default async function SupportPage() {
  if (!(await requireSuperAdmin())) redirect("/");
  const svc = createSupabaseServiceClient();
  const [{ data: ticketsRaw, error: tErr }, { data: tenantsRaw, error: tenErr }, stalledSetting] = await Promise.all([
    svc.from("support_tickets").select("id, tenant_id, submitted_by, actor_label, title, body, status, priority, ticket_type, ai_triage_summary, ai_guidance, platform_notes, created_at, updated_at, resolved_at").eq("ticket_type", "platform").order("created_at", { ascending: false }),
    svc.from("tenants").select("id, name, slug"),
    getSetting("support_stalled_days"),
  ]);
  if (tErr) throw tErr;
  if (tenErr) throw tenErr;
  const tenantMap = new Map<string, TenantRow>((tenantsRaw ?? []).map((t) => [t.id, t as TenantRow]));
  const tickets = (ticketsRaw ?? []).map((ticket) => {
    const tenant = tenantMap.get(ticket.tenant_id);
    return { ...ticket, tenant_name: tenant?.name ?? null, tenant_slug: tenant?.slug ?? null };
  });
  const stalledDays = stalledSetting ? parseInt(stalledSetting, 10) : 3;
  const openCount = tickets.filter((t) => t.status === "open").length;
  return (
    <main className="px-6 py-5">
      <PageHeader
        title="Support"
        subtitle={`Platform-wide ticket queue — ${openCount > 0 ? `${openCount} open ticket${openCount !== 1 ? "s" : ""}` : "no open tickets"} · ${tickets.length} total`}
      />
      <SupportConsole tickets={tickets} stalledDays={stalledDays} />
    </main>
  );
}
