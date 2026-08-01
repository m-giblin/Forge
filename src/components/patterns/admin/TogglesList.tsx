"use client";

import type { ReactNode } from "react";
import Toggle from "../Toggle";

export type ToggleItem = {
  key: string;
  label: string;
  description?: string;
  on: boolean;
  tag?: ReactNode;
};

/** §3.2 `toggles` block — label + description + switch, optional right-side tag. */
export default function TogglesList({
  items,
  onChange,
  platform = false,
}: {
  items: ToggleItem[];
  onChange: (key: string, next: boolean) => void;
  platform?: boolean;
}) {
  return (
    <div className="fw-card overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.key}
          className={`flex items-center gap-3 px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-[#20201d]">{item.label}</p>
            {item.description && (
              <p className="mt-0.5 text-[11px] text-[#726e60]">{item.description}</p>
            )}
          </div>
          {item.tag && <div className="shrink-0">{item.tag}</div>}
          <Toggle on={item.on} onChange={(next) => onChange(item.key, next)} platform={platform} label={item.label} />
        </div>
      ))}
    </div>
  );
}
