import Link from "next/link";
import type { ProjectPortalData } from "@/lib/services/projectPortal";
import type { ProjectWikiPage } from "@/lib/repositories/projects";
import WikiPanel from "./WikiPanel";

const SIGNOFF_META: Record<string, { label: string; icon: string }> = {
  design: { label: "Design", icon: "🎨" },
  product: { label: "Product", icon: "📊" },
  engineering: { label: "Engineering", icon: "⚙️" },
};

function MiniBars({ data }: { data: { label: string; done: number }[] }) {
  const w = 460, h = 120, pad = 22;
  const max = Math.max(1, ...data.map((d) => d.done));
  const bw = (w - pad * 2) / data.length;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="w-full">
      {data.map((d, i) => {
        const barW = bw * 0.5;
        const cx = pad + bw * i + (bw - barW) / 2;
        const top = y(d.done);
        return (
          <g key={i}>
            {d.done > 0 && (
              <text x={pad + bw * i + bw / 2} y={top - 5} textAnchor="middle" className="fill-neutral-500" fontSize="10" fontWeight="600">{d.done}</text>
            )}
            <rect x={cx} y={top} width={barW} height={Math.max(0, h - pad - top)} fill="#6366f1" rx="3" />
            <text x={pad + bw * i + bw / 2} y={h - pad + 13} textAnchor="middle" className="fill-neutral-400" fontSize="9">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ProjectOverview({
  slug,
  data,
  wiki,
  canEdit,
}: {
  slug: string;
  data: ProjectPortalData;
  wiki: ProjectWikiPage | null;
  canEdit: boolean;
}) {
  const batteryTotal = data.battery.reduce((s, b) => s + b.count, 0) || 1;
  const isEmpty = data.total === 0;

  return (
    <div className="space-y-5">
      {/* Attention strip — explainable, only when there's something to flag */}
      {data.attention.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">This project needs attention</p>
            <p className="text-sm text-amber-800">{data.attention.join(" · ")}.</p>
          </div>
        </div>
      )}

      {isEmpty ? (
        /* Empty/new project — guided, not a dead zero */
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">No work yet — let&rsquo;s get this project moving.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
            Add the first issues on the board, set a go-live date, and the live dashboard (progress, throughput, health) fills in here.
          </p>
          <Link
            href={`/${slug}/board?project=${data.project.key}`}
            className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Open board to add work →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-5">
            {/* Progress battery */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900">Progress</h3>
                <span className="text-sm text-neutral-500"><strong className="text-neutral-900">{data.done}</strong> of {data.total} done · {data.pct}%</span>
              </div>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-neutral-100">
                {data.battery.map((s) => (
                  <div key={s.key} className={s.color} style={{ width: `${(s.count / batteryTotal) * 100}%` }} title={`${s.label}: ${s.count}`} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {data.battery.map((s) => (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
                    <span className="text-xs text-neutral-600">{s.label} <span className="font-semibold text-neutral-900">{s.count}</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Throughput */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900">Throughput</h3>
                <span className="text-xs text-neutral-500">issues shipped / week · last 6 weeks</span>
              </div>
              <p className="mb-3 text-sm text-neutral-500">
                {data.avgCycleDays != null
                  ? `Average cycle time (created → done): ${data.avgCycleDays} days.`
                  : "Cycle time appears once issues complete through the board."}
              </p>
              {data.hasWeeklyData ? (
                <MiniBars data={data.weekly} />
              ) : (
                <p className="py-6 text-center text-sm text-neutral-400">No completions in the last 6 weeks yet.</p>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Go-live</p>
              {data.goLive.days != null ? (
                <p className="mt-1 text-3xl font-bold text-neutral-900">{data.goLive.days < 0 ? `${-data.goLive.days}` : data.goLive.days} <span className="text-base font-normal text-neutral-500">days {data.goLive.days < 0 ? "overdue" : "out"}</span></p>
              ) : (
                <p className="mt-1 text-sm italic text-neutral-400">No date set</p>
              )}
              {(data.project.startDate || data.project.targetGoLive) && (
                <div className="mt-3 flex justify-between text-[11px] text-neutral-400">
                  <span>{fmt(data.project.startDate)} · start</span>
                  <span>{fmt(data.project.targetGoLive)} · go-live</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Team</p>
              {data.members.length === 0 ? (
                <p className="text-sm text-neutral-400">{data.leadName ? data.leadName : "No team yet."}</p>
              ) : (
                <div className="space-y-2.5">
                  {data.members.map((m) => (
                    <div key={m.name} className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
                        {m.name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm text-neutral-700">{m.name}</span>
                      <span className="ml-auto text-xs capitalize text-neutral-400">{m.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provenance — the differentiator */}
      {data.provenance && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold text-neutral-900">Why this project exists</h3>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">PROVENANCE</span>
          </div>
          <p className="mb-4 text-sm text-neutral-500">The origin, decisions, and sign-offs that led here — carried from Think Tank so the &ldquo;why&rdquo; never gets lost.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Origin</p>
              <p className="mt-2 text-sm font-medium text-neutral-900">💡 {data.provenance.ideaTitle}</p>
              <Link href={`/${slug}/think-tank/${data.provenance.ideaId}`} className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline">
                View in Think Tank →
              </Link>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Decisions</p>
              {data.decisions.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-400">None recorded.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.decisions.map((d) => (
                    <li key={d.id} className="text-sm text-neutral-700">
                      ✅ <strong>{d.title}</strong>
                      {d.body && <span className="block text-xs text-neutral-500">{d.body}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Sign-offs</p>
              <div className="mt-2 space-y-1.5">
                {data.signoffRoles.map((role) => {
                  const s = data.signoffs.find((x) => x.role === role);
                  const m = SIGNOFF_META[role] ?? { label: role, icon: "•" };
                  return (
                    <div key={role} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700">{m.icon} {m.label}</span>
                      {s ? (
                        <span className="text-xs font-semibold text-green-700">✓ {s.approvedByName ?? "approved"}</span>
                      ) : (
                        <span className="text-xs text-neutral-400">pending</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project brief (wiki) */}
      <WikiPanel slug={slug} projectKey={data.project.key} wiki={wiki} canEdit={canEdit} />

      {/* Recent activity */}
      {data.activity.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Recent activity</p>
          <div className="space-y-2.5 text-sm">
            {data.activity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-neutral-600">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
                <span>{a.text}</span>
                <span className="ml-auto text-xs text-neutral-400">{a.when}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
