import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { customersRepo } from "@/lib/repositories/customers";
import CustomersClient from "./CustomersClient";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();
  // Fails open if migration 0066 hasn't been applied yet
  const customers = await customersRepo(supabase).list(ctx.tenant.id).catch(() => []);
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";

  return <CustomersClient slug={slug} customers={customers} isAdmin={isAdmin} />;
}
