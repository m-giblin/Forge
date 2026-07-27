import type { getWeeklyTimesheetAction, getActiveTimerAction } from "./actions";

// ─── Shared types ───────────────────────────────────────────────────────────

export type WeekData = Awaited<ReturnType<typeof getWeeklyTimesheetAction>>;
export type ActiveTimer = Awaited<ReturnType<typeof getActiveTimerAction>>;
export type LogEntry = WeekData["entries"][number]["logs"][number];
export type IssueEntry = WeekData["entries"][number];

// ─── Formatting helpers ─────────────────────────────────────────────────────

export function fmtMinutes(m: number): string {
  if (m <= 0) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

export function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split("T")[0];
}

export function fmtDateHeader(dateStr: string): { day: string; num: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    day: d.toLocaleDateString("en-US", { weekday: "short" }),
    num: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

export function fmtWeekRange(weekStart: string): string {
  const dates = getWeekDates(weekStart);
  const start = new Date(dates[0] + "T00:00:00");
  const end = new Date(dates[6] + "T00:00:00");
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function isCurrentWeek(weekStart: string): boolean {
  const today = todayStr();
  const dates = getWeekDates(weekStart);
  return dates.includes(today);
}

export function elapsedDisplay(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

export const TAG_PRESETS = ["Development", "Review", "Meetings", "Testing", "Design", "Planning", "Support"] as const;

export function TagSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-neutral-700">Tag <span className="text-neutral-400 font-normal">(optional)</span></label>
      <div className="flex flex-wrap gap-1.5">
        {TAG_PRESETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(value === t ? "" : t)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors ${
              value === t
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="or custom…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}
