import { resolveGuestLink } from "@/lib/services/guestLinks";
import { loadBoard } from "@/lib/services/issues";
import { listMembers } from "@/lib/services/members";
// eslint-disable-next-line no-restricted-imports -- public unauthenticated route: no session exists to scope an RLS client, must use service-role + explicit ids resolved from the validated token (see migration 0115)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import GuestProjectView from "./GuestProjectView";

export const dynamic = "force-dynamic";

export default async function SharedProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const link = token ? await resolveGuestLink(token) : null;

  if (!link) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-neutral-900">Link not found</p>
          <p className="mt-1 text-sm text-neutral-500">This guest link is invalid or has been revoked. Ask whoever shared it with you for a new one.</p>
        </div>
      </main>
    );
  }

  // Every query below is explicitly scoped to link.tenant_id / link.project_id —
  // ids resolved from the validated token row, never from any client-supplied param.
  const svc = createSupabaseServiceClient();

  const [board, members, projectRow, phasesResult] = await Promise.all([
    loadBoard(link.tenant_id, true, link.project_id),
    listMembers(link.tenant_id, true),
    svc.from("projects").select("id, key, name, target_go_live, phase_id").eq("tenant_id", link.tenant_id).eq("id", link.project_id).maybeSingle(),
    svc.from("roadmap_phases").select("id, name, color, start_date, end_date").eq("tenant_id", link.tenant_id),
  ]);

  const project = projectRow.data;
  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-neutral-900">Project not found</p>
          <p className="mt-1 text-sm text-neutral-500">This project may have been deleted.</p>
        </div>
      </main>
    );
  }

  const phases = (phasesResult.data ?? []) as { id: string; name: string; color: string; start_date: string | null; end_date: string | null }[];
  const phase = phases.find((p) => p.id === (project as { phase_id?: string | null }).phase_id) ?? null;

  // Only show a real display name — never fall back to email on this public,
  // unauthenticated route (unlike internal admin views, which do fall back to
  // email since only tenant members can see those).
  const memberMap = Object.fromEntries(members.filter((m) => m.name).map((m) => [m.userId, m.name as string]));

  return (
    <GuestProjectView
      project={{ key: project.key as string, name: project.name as string, targetGoLive: (project as { target_go_live?: string | null }).target_go_live ?? null }}
      phase={phase}
      statuses={board.statuses.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
      priorities={board.priorities.map((p) => ({ key: p.key, label: p.label, color: p.color }))}
      types={board.types.map((t) => ({ key: t.key, label: t.label }))}
      issues={board.issues.map((i) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        status: i.status,
        priority: i.priority,
        type: i.type,
        assigneeName: i.assignee_id ? (memberMap[i.assignee_id] ?? null) : null,
      }))}
    />
  );
}
