import { notFound } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- public portal: no user JWT, service-role needed
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import PortalClient from "./PortalClient";

export default async function CustomerPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ ref?: string; email?: string; tab?: string }>;
}) {
  const { tenant: slug } = await params;
  const { ref, email, tab } = await searchParams;

  const svc = createSupabaseServiceClient();

  const { data: tenant } = await svc
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  // Load recent public changelog (done issues, last 10 weeks)
  const { data: changelog } = await svc
    .from("issues")
    .select("id, number, title, type, updated_at, projects(key)")
    .eq("tenant_id", tenant.id)
    .eq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(20);

  // If a ticket ref + email lookup is requested, fetch the ticket
  let ticket: { id: string; title: string; status: string; type: string; created_at: string; updated_at: string } | null = null;
  if (ref && email) {
    const { data: found } = await svc
      .from("support_tickets")
      .select("id, title, status, type, created_at, updated_at")
      .eq("tenant_id", tenant.id)
      .eq("id", ref)
      .ilike("requester_email", email.trim())
      .maybeSingle();
    ticket = found ?? null;
  }

  return (
    <PortalClient
      slug={slug}
      tenantName={tenant.name}
      changelog={(changelog ?? []).map((r) => ({
        id: r.id as string,
        number: r.number as number,
        title: r.title as string,
        type: r.type as string,
        updated_at: r.updated_at as string,
        projectKey: (Array.isArray(r.projects) ? r.projects[0] : r.projects as { key: string } | null)?.key ?? "??",
      }))}
      initialTicket={ticket}
      initialTab={(tab as "submit" | "status" | "changelog") ?? "submit"}
    />
  );
}
