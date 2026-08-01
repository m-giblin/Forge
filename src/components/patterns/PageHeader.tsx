import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-b border-[var(--fw-cream-border)] bg-[var(--fw-cream-bg)] px-6 pt-4 pb-3.5"
    >
      <div className="min-w-0">
        <h1 className="truncate text-[21px] font-extrabold font-[family-name:var(--font-manrope)] text-[#20201d]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[12.5px] text-[#726e60]">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
