"use client";

import { useEffect, useState } from "react";
import { avatarColor } from "@/lib/ui/avatar";

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
          <h1 className="text-[21px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">Dashboards</h1>
          <p className="mt-1 text-[12.5px] text-[#726e60]">Compose your own view — add or remove widgets</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newWidgetType}
            onChange={(e) => setNewWidgetType(e.target.value as WidgetType)}
            className="rounded-lg border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-1.5 text-sm text-[#20201d]"
          >
            {(Object.keys(WIDGET_LABEL) as WidgetType[]).map((k) => (
              <option key={k} value={k}>{WIDGET_LABEL[k]}</option>
            ))}
          </select>
          <button
            onClick={addWidget}
            className="rounded-[5px] border border-[#5e2c1f] px-[13px] py-[7px] text-[12px] font-bold text-[#f2e9d8]"
            style={{ backgroundImage: "linear-gradient(160deg,#9a5138,#6e3324)" }}
          >
            + Add widget
          </button>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#ddd8c9] bg-[#f4f2eb] px-6 py-16 text-center text-sm text-[#726e60]">
          No widgets yet — add one above.
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {widgets.map((w) => (
            <div key={w.id} className="fw-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">{WIDGET_LABEL[w.type]}</span>
                <button
                  onClick={() => removeWidget(w.id)}
                  aria-label={`Remove ${WIDGET_LABEL[w.type]} widget`}
                  className="text-[#a19d90] hover:text-[#20201d]"
                >
                  ×
                </button>
              </div>

              {w.type === "stat" && (
                <div className="grid grid-cols-2 gap-2.5">
                  {statCards.map((s) => (
                    <div key={s.label} className="rounded-lg border border-[#e3ded0] px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a19d90]">{s.label}</div>
                      <div className="text-xl font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {w.type === "donut" && (
                <div className="flex flex-col gap-2.5">
                  {statusDistribution.length === 0 && <p className="text-[11px] text-[#a19d90]">No issues yet.</p>}
                  {statusDistribution.map((d) => (
                    <div key={d.label}>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="font-medium text-[#4a473e]">{d.label}</span>
                        <span className="text-[#a19d90]">{d.count} · {d.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#e3ded0]">
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
                      <span className="text-[11px] text-[#c3bda9]">{d.label[0]}</span>
                    </div>
                  ))}
                </div>
              )}

              {w.type === "list" && (
                <div className="flex flex-col gap-2">
                  {workloadRows.length === 0 && <p className="text-[11px] text-[#a19d90]">No active assigned work.</p>}
                  {workloadRows.map((t) => {
                    const maxCount = Math.max(1, ...workloadRows.map((r) => r.activeCount));
                    const avColor = avatarColor(t.userId);
                    return (
                      <div key={t.userId} className="flex items-center gap-2">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: avColor }}>
                          {t.initials}
                        </div>
                        <div className="flex-1 truncate text-xs text-[#20201d]">{t.name}</div>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#e3ded0]">
                          <div className="h-full rounded-full bg-[#8c4632]" style={{ width: `${(t.activeCount / maxCount) * 100}%` }} />
                        </div>
                        {t.blockedCount > 0 && (
                          <span className="shrink-0 rounded-full bg-[#fbeae8] px-1.5 py-0.5 text-[11px] font-semibold text-[#c0392b]">
                            {t.blockedCount} blocked
                          </span>
                        )}
                        <span className="w-16 shrink-0 text-right text-xs font-semibold text-[#4a473e]">
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
