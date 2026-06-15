import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { projectsRepo } from "@/lib/repositories/projects";
import { issuesRepo } from "@/lib/repositories/issues";
import { ideasRepo } from "@/lib/repositories/ideas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function goLiveChip(target: string | null) {
  if (!target) return { text: "No go-live date", cls: "bg-neutral-100 text-neutral-500" };
  const days = Math.ceil((new Date(target + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `Overdue by ${-days}d`, cls: "bg-red-100 text-red-700" };
  if (days === 0) return { text: "Go-live today", cls: "bg-amber-100 text-amber-700" };
  if (days <= 14) return { text: `Go-live in ${days}d`, cls: "bg-amber-100 text-amber-700" };
  return { text: `Go-live in ${days}d`, cls: "bg-emerald-100 text-emerald-700" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; key: string }>;
}) {
  const { tenant: slug, key } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = ctx.impersonating
    ? createSupabaseServiceClient()
    : await createSupabaseServerClient();

  const project = await projectsRepo(supabase).getByKey(ctx.tenant.id, key);
  if (!project) notFound();

  const [issueCounts, leadUser, linkedIdea] = await Promise.all([
    issuesRepo(supabase).countForProject(ctx.tenant.id, project.id),
    project.lead_user_id
      ? supabase
          .from("users")
          .select("id, name, email")
          .eq("id", project.lead_user_id)
          .maybeSingle()
          .then((r) => r.data as { id: string; name: string | null; email: string } | null)
      : Promise.resolve(null),
    project.linked_idea_id
      ? ideasRepo(supabase).getById(ctx.tenant.id, project.linked_idea_id)
      : Promise.resolve(null),
  ]);

  const chip = goLiveChip(project.target_go_live);
  const openCount = issueCounts.total - issueCounts.done;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-neutral-400">
        <Link href={`/${slug}`} className="hover:text-neutral-600">Projects</Link>
        <span>/</span>
        <span className="font-mono text-neutral-500">{project.key}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-600">
              {project.key}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chip.cls}`}>
              {chip.text}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">{project.name}</h1>
        </div>
        <Link
          href={`/${slug}/board?project=${project.key}`}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Open board →
        </Link>
      </div>

      {/* Metadata card */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Owner</dt>
            <dd className="mt-1 text-neutral-700">
              {leadUser ? (leadUser.name ?? leadUser.email) : <span className="italic text-neutral-400">Unassigned</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Start date</dt>
            <dd className="mt-1 text-neutral-700">{fmtDate(project.start_date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Go-live</dt>
            <dd className="mt-1 text-neutral-700">{fmtDate(project.target_go_live)}</dd>
          </div>
        </dl>
      </div>

      {/* Issue stats */}
      <div className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Issues</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: issueCounts.total, cls: "text-neutral-900" },
            { label: "Open", value: openCount, cls: openCount > 0 ? "text-blue-600" : "text-neutral-400" },
            { label: "Done", value: issueCounts.done, cls: issueCounts.done > 0 ? "text-emerald-600" : "text-neutral-400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm"
            >
              <p className={`text-3xl font-bold tabular-nums ${stat.cls}`}>{stat.value}</p>
              <p className="mt-1 text-xs text-neutral-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Linked Think Tank idea */}
      {linkedIdea && (
        <div className="mb-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Originated from Think Tank
          </p>
          <Link
            href={`/${slug}/think-tank/${linkedIdea.id}`}
            className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow"
          >
            <span className="mt-0.5 text-lg">💡</span>
            <div>
              <p className="font-medium text-neutral-900">{linkedIdea.title}</p>
              <p className="mt-0.5 text-xs text-neutral-400">
                Converted idea · View in Think Tank →
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">Quick actions</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${slug}/board?project=${project.key}`}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Kanban board
          </Link>
          <Link
            href={`/${slug}/issues?project=${project.key}`}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Issue list
          </Link>
          <Link
            href={`/${slug}`}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            All projects
          </Link>
        </div>
      </div>
    </div>
  );
}
