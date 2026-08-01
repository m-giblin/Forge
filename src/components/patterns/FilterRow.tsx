import type { ReactNode } from "react";

export function FilterRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-nowrap items-center gap-[7px] overflow-x-auto">
      {children}
    </div>
  );
}

export function FilterPill({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-[11px] py-[6px] text-[11.5px] font-semibold transition-colors ${
        active
          ? "border-[#8c4632] bg-[#8c4632] text-[#f2e9d8]"
          : "border-[#ddd8c9] bg-[#f4f2eb] text-[#4a473e] hover:bg-[#eae6da]"
      }`}
    >
      {children}
    </button>
  );
}
