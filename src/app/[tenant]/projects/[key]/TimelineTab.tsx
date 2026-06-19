import Link from "next/link";
import type { ProjectTimelineData } from "@/lib/services/projectPortal";

const LEGEND = [
  { l: "Backlog", c: "bg-neutral-300" },
  { l: "Todo", c: "bg-sky-400" },
  { l: "In progress", c: "bg-indigo-500" },
  { l: "In review", c: "bg-amber-400" },
  { l: "Done", c: "bg-emerald-500" },
];

export default function TimelineTab({ slug, data }: { slug: string; data: ProjectTimelineData }) {
  if (data.scheduledCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
        <p className="text-base font-semibold text-neutral-900">No scheduled work yet</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-500">
          Add a <strong>start</strong> and/or <strong>due date</strong> to issues (on the issue page) and they&rsquo;ll appear here on the timeline — colored by status, with today and go-live markers.
        </p>
        {data.totalCount === 0 && (
          <Link href={`/${slug}/board`} className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            Open board to add issues →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <strong className="text-neutral-900">Lightweight timeline.</strong> Each bar is an issue on a track by its start/due date, colored by status. {data.scheduledCount} of {data.totalCount} issues scheduled.
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        {/* Axis labels */}
        <div className="ml-44 flex justify-between text-[11px] text-neutral-400">
          <span>{data.rangeStartLabel}</span>
          <span>{data.rangeEndLabel}</span>
        </div>

        <div className="relative mt-2">
          {/* today + go-live verticals */}
          <div className="pointer-events-none absolute inset-y-0 left-44 right-0">
            {data.todayPct != null && (
              <>
                <div className="absolute inset-y-0 w-px bg-indigo-400" style={{ left: `${data.todayPct}%` }} />
                <div className="absolute -top-4 -translate-x-1/2 text-[10px] font-medium text-indigo-500" style={{ left: `${data.todayPct}%` }}>today</div>
              </>
            )}
            {data.goLivePct != null && (
              <>
                <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: `${data.goLivePct}%` }} />
                <div className="absolute -top-4 -translate-x-1/2 text-[10px] font-medium text-red-500" style={{ left: `${data.goLivePct}%` }}>go-live</div>
              </>
            )}
          </div>

          <div className="space-y-2">
            {data.bars.map((b) => (
              <div key={b.id} className="flex items-center">
                <Link href={`/${slug}/issues/${b.id}`} className="w-44 shrink-0 truncate pr-3 text-xs text-neutral-600 hover:text-neutral-900" title={b.title}>
                  <span className="font-mono text-neutral-400">{b.ref}</span> {b.title}
                </Link>
                <div className="relative h-6 flex-1 rounded bg-neutral-50">
                  <div
                    className={`absolute top-1 h-4 rounded ${b.color}`}
                    style={{ left: `${b.startPct}%`, width: `${b.endPct - b.startPct}%` }}
                    title={`${b.ref}: ${b.title}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ml-44 mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND.map((x) => (
            <div key={x.l} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${x.c}`} />
              <span className="text-xs text-neutral-600">{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
