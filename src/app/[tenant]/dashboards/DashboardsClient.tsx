"use client";

import { useEffect, useState } from "react";

export type StatCard = { label: string; value: number };
export type StatusSlice = { label: string; count: number; pct: number; color: string };
export type ThroughputDay = { label: string; count: number };
export type WorkloadRow = { userId: string; name: string; initials: string; activeCount: number; blockedCount: number };

type WidgetType = "stat" | "donut" | "bar" | "list";
type Widget = { id: string; type: WidgetType };

const WIDGET_LABEL: Record<WidgetType, string> = {
  stat: "Stat row",
  donut: "Status breakdown",
  bar: "Issues completed (14d)",
  list: "Team workload",
};

const DEFAULT_WIDGETS: Widget[] = [
  { id: "w1", type: "stat" },
  { id: "w2", type: "donut" },
  { id: "w3", type: "bar" },
  { id: "w4", type: "list" },
];


export default function DashboardsClient({
  slug,
  statCards,
  statusDistribution,
  throughputDays,
  maxDayCount,
  workloadRows,
}: {
  slug: string;
  statCards: StatCard[];
  statusDistribution: StatusSlice[];
  throughputDays: ThroughputDay[];
  maxDayCount: number;
  workloadRows: WorkloadRow[];
}) {
  const storageKey = `forge:dashboards:${slug}`;
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [newWidgetType, setNewWidgetType] = useState<WidgetType>("stat");
  const [loaded, setLoaded] = useState(false);

  // Load persisted widget layout on mount (setTimeout defers past render, same pattern as ReportsClient).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) setWidgets(JSON.parse(raw));
      } catch {
        // localStorage unavailable or corrupt — fall back to defaults, no need to surface an error.
      }
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widgets));
    } catch {
      // best-effort persistence only
    }
  }, [widgets, loaded, storageKey]);

  const addWidget = () => {
    setWidgets((w) => [...w, { id: `w-${w.length}-${w.map((x) => x.id).join("")}`, type: newWidgetType }]);
  };
  const removeWidget = (id: string) => setWidgets((w) => w.filter((x) => x.id !== id));

  return (
    <main className="w-full px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Dashboards</h1>
          <p className="mt-1 text-sm text-neutral-500">A widget board you compose yourself — add, remove, and rearrange.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newWidgetType}
            onChange={(e) => setNewWidgetType(e.target.value as WidgetType)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm"
          >
            {(Object.keys(WIDGET_LABEL) as WidgetType[]).map((k) => (
              <option key={k} value={k}>{WIDGET_LABEL[k]}</option>
            ))}
          </select>
          <button
            onClick={addWidget}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Add widget
          </button>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center text-sm text-neutral-500">
          No widgets yet — add one above.
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {widgets.map((w) => (
            <div key={w.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900">{WIDGET_LABEL[w.type]}</span>
                <button
                  onClick={() => removeWidget(w.id)}
                  aria-label={`Remove ${WIDGET_LABEL[w.type]} widget`}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  ×
                </button>
              </div>

              {w.type === "stat" && (
                <div className="grid grid-cols-2 gap-2.5">
                  {statCards.map((s) => (
                    <div key={s.label} className="rounded-lg border border-neutral-100 px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{s.label}</div>
                      <div className="text-xl font-semibold text-neutral-900">{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {w.type === "donut" && (
                <div className="flex flex-col gap-2.5">
                  {statusDistribution.length === 0 && <p className="text-xs text-neutral-400">No issues yet.</p>}
                  {statusDistribution.map((d) => (
                    <div key={d.label}>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="font-medium text-neutral-600">{d.label}</span>
                        <span className="text-neutral-400">{d.count} · {d.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {w.type === "bar" && (
                <div className="flex h-24 items-end gap-1.5">
                  {throughputDays.map((d, idx) => (
                    <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-[var(--fw-rust,#8c4632)]"
                        style={{ height: `${Math.max(4, (d.count / maxDayCount) * 100)}%` }}
                        title={`${d.count} completed`}
                      />
                      <span className="text-[9px] text-neutral-400">{d.label[0]}</span>
                    </div>
                  ))}
                </div>
              )}

              {w.type === "list" && (
                <div className="flex flex-col gap-2">
                  {workloadRows.length === 0 && <p className="text-xs text-neutral-400">No active assigned work.</p>}
                  {workloadRows.map((t) => {
                    const maxCount = Math.max(1, ...workloadRows.map((r) => r.activeCount));
                    return (
                      <div key={t.userId} className="flex items-center gap-2">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                          {t.initials}
                        </div>
                        <div className="flex-1 truncate text-xs text-neutral-800">{t.name}</div>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(t.activeCount / maxCount) * 100}%` }} />
                        </div>
                        {t.blockedCount > 0 && (
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            {t.blockedCount} blocked
                          </span>
                        )}
                        <span className="w-16 shrink-0 text-right text-xs font-semibold text-neutral-700">
                          {t.activeCount} active
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
