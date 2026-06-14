import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { loadBoard } from "@/lib/services/issues";
import IssuesTable from "./IssuesTable";

export default async function IssuesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const { issues, projects, statuses, priorities, types, customFields } = await loadBoard(ctx.tenant.id, ctx.impersonating);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <IssuesTable slug={slug} issues={issues} projects={projects} statuses={statuses} priorities={priorities} types={types} customFields={customFields} />
    </main>
  );
}
