import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import AdvancedSearchClient from "./AdvancedSearchClient";

export default async function AdvancedSearchPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  return (
    <main className="w-full px-6 py-8">
      <AdvancedSearchClient slug={slug} readOnly={ctx.role === "viewer"} />
    </main>
  );
}
