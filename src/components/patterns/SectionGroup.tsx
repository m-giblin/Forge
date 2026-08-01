"use client";

import { useState, type ReactNode } from "react";

export default function SectionGroup({
  label,
  color,
  count,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  label: string;
  color: string;
  count?: number;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showChildren = !collapsible || open;

  return (
    <div>
      <div
        className={`mb-1.5 flex items-center gap-1.5 px-0.5 ${collapsible ? "cursor-pointer select-none -ml-1" : ""}`}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        {collapsible && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] hover:bg-[#00000010]">
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#726e60" strokeWidth="3"
              className="shrink-0 transition-transform"
              style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        )}
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span
          className="text-[11px] font-extrabold uppercase tracking-[0.07em]"
          style={{ color }}
        >
          {label}
        </span>
        {count !== undefined && (
          <span className="text-[11px] text-[#a19d90]">{count}</span>
        )}
      </div>
      {showChildren && <div className="fw-card overflow-hidden">{children}</div>}
    </div>
  );
}
