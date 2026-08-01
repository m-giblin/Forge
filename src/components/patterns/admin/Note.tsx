import type { ReactNode } from "react";

/** §3.2 `note` block — tinted banner: icon + one line of text. */
export default function Note({
  icon,
  children,
  tone = "info",
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: "info" | "warning" | "error";
}) {
  const tones: Record<string, { bg: string; border: string; fg: string }> = {
    info: { bg: "#eaf1f8", border: "#c9d9e8", fg: "#3a6ea8" },
    warning: { bg: "#fdf1de", border: "#f0dcb8", fg: "#c9791d" },
    error: { bg: "#fbeae8", border: "#f0cfc9", fg: "#c0392b" },
  };
  const t = tones[tone];
  return (
    <div
      className="flex items-center gap-2.5 rounded-[6px] border px-3.5 py-2.5 text-[12px] text-[#20201d]"
      style={{ backgroundColor: t.bg, borderColor: t.border }}
    >
      <span className="shrink-0 text-[14px]" style={{ color: t.fg }} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
