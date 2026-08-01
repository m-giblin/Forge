// Small shared presentational primitives used across the issue-detail panels.

const ICON_PATHS: Record<string, React.ReactNode> = {
  check: <polyline points="20 6 9 17 4 12" />,
  play: <polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none" />,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>,
  circle: <circle cx="12" cy="12" r="9" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  circleCheck: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  bug: <><path d="M9 9V8a3 3 0 0 1 6 0v1" /><path d="M8 9h8a5 5 0 0 1 1 3v2a5 5 0 0 1-10 0v-2a5 5 0 0 1 1-3" /><path d="M3 13h4" /><path d="M17 13h4" /><path d="M12 20v-6" /><path d="m4 19 3-2" /><path d="m20 19-3-2" /><path d="m4 8 3 1.5" /><path d="m20 8-3 1.5" /></>,
  flame: <path d="M12 12c2-3 0-7-1-8 0 3-1.8 4.7-3 6s-2 3.2-2 5a6 6 0 1 0 12 0c0-1.5-1-3.9-2-5-1.8 3-2.8 3-4 2Z" />,
};

export function Icon({ name, size = 16, className, strokeWidth = 2 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICON_PATHS[name] ?? ICON_PATHS.circle}
    </svg>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip ml-1 align-middle">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neutral-200 text-neutral-500 text-[9px] font-bold cursor-default select-none leading-none group-hover/tip:bg-neutral-300">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 rounded-lg bg-[#20201d] px-3 py-2 text-[11px] text-white leading-relaxed shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#20201d]" />
      </span>
    </span>
  );
}

export function SideGroupLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${color}`}>{children}</p>;
}

export function statusIconName(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("backlog")) return "inbox";
  if (k.includes("progress") || k === "doing") return "play";
  if (k.includes("review")) return "eye";
  if (k.includes("done") || k.includes("closed") || k.includes("complete") || k.includes("resolved")) return "circleCheck";
  return "circle";
}

export function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function avatarInitials(label: string | null): string {
  if (!label) return "?";
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

export function avatarColor(label: string | null): string {
  const colors = ["bg-[#3a6ea8]","bg-[#7a4fa0]","bg-[#3f7d4c]","bg-[#c9791d]","bg-[#c0392b]","bg-[#8c4632]","bg-[#b7452f]","bg-[#726e60]"];
  if (!label) return colors[0];
  const idx = [...label].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

// ── Sidebar panel shared class strings ──
export const sidebarSelect =
  "w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500";
export const sideLabel = "mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500";
