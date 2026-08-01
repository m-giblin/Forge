import type { ReactNode } from "react";

export type AdminListItem = {
  key: string;
  title: ReactNode;
  subline?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

/** §3.2 `list` block — title + sub-line + right meta + action link, optional left badge. */
export default function AdminList({ items }: { items: AdminListItem[] }) {
  return (
    <div className="fw-card overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.key}
          className={`flex items-center gap-3 px-3.5 py-[11px] ${i > 0 ? "border-t border-[#e3ded0]" : ""}`}
        >
          {item.badge && <span className="shrink-0">{item.badge}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-[#20201d]">{item.title}</p>
            {item.subline && <p className="mt-0.5 truncate text-[11.5px] text-[#726e60]">{item.subline}</p>}
          </div>
          {item.meta && <span className="shrink-0 text-[11px] text-[#a19d90]">{item.meta}</span>}
          {item.onAction && (
            <button
              type="button"
              onClick={item.onAction}
              className="shrink-0 text-[11.5px] font-semibold text-[#b7452f] hover:underline"
            >
              {item.actionLabel ?? "View"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
