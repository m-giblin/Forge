import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTenantContext } from "@/lib/auth";
import { loadBoard } from "@/lib/services/issues";
import { listMembers } from "@/lib/services/members";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { savedViewsRepo } from "@/lib/repositories/savedViews";
import IssuesTable from "./IssuesTable";

export default async function IssuesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();
  const [board, members, savedViews] = await Promise.all([
    loadBoard(ctx.tenant.id, ctx.impersonating),
    listMembers(ctx.tenant.id, ctx.impersonating),
    savedViewsRepo(supabase).list(ctx.tenant.id).catch(() => []),
  ]);

  const { issues, projects, statuses, priorities, types, customFields } = board;
  const canDelete = ctx.role === "owner" || ctx.role === "admin";

  return (
    <main className="w-full px-3 py-4 sm:px-6 sm:py-6">
      <Suspense fallback={null}>
      <IssuesTable
        slug={slug}
        issues={issues}
        projects={projects}
        statuses={statuses}
        priorities={priorities}
        types={types}
        members={members.map((m) => ({ userId: m.userId, label: m.name || m.email }))}
        customFields={customFields}
        canDelete={canDelete}
        savedViews={savedViews}
      />
      </Suspense>
    </main>
  );
}
