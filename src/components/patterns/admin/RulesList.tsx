"use client";

import Toggle from "../Toggle";

export type RuleItem = {
  key: string;
  name: string;
  condition: string;
  action: string;
  on: boolean;
};

/** §3.2 `rules` block — rule row: name, "When X → then Y", switch, Delete. */
export default function RulesList({
  items,
  onToggle,
  onDelete,
}: {
  items: RuleItem[];
  onToggle: (key: string, next: boolean) => void;
  onDelete?: (key: string) => void;
}) {
  return (
    <div className="fw-card overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.key}
          className={`flex items-center gap-3 px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-[#20201d]">{item.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#726e60]">
              When {item.condition} → then {item.action}
            </p>
          </div>
          <Toggle on={item.on} onChange={(next) => onToggle(item.key, next)} label={item.name} />
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(item.key)}
              className="shrink-0 text-[11.5px] font-semibold text-[#c0392b] hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
