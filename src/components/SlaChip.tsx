import type { SlaTimer } from "@/lib/services/sla";

const COLORS: Record<string, string> = {
  ok: "bg-emerald-900/40 text-emerald-400 border-emerald-800",
  warning: "bg-amber-900/40 text-amber-400 border-amber-800",
  breach: "bg-red-900/40 text-red-400 border-red-800",
};

export default function SlaChip({ timer }: { timer: SlaTimer }) {
  if (timer.status === "none") return null;
  const cls = COLORS[timer.status] ?? COLORS.ok;
  return (
    <span
      title={`SLA: ${timer.policyName}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border font-medium ${cls}`}
    >
      ⏱ {timer.label}
    </span>
  );
}
