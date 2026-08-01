import type { ReactNode } from "react";

export default function ListRow({
  issueKey,
  title,
  right,
  first = false,
  onClick,
}: {
  issueKey?: string;
  title: ReactNode;
  right?: ReactNode;
  first?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3.5 py-[11px] text-left ${
        first ? "" : "border-t border-[#e3ded0]"
      } ${onClick ? "hover:bg-[#eae6da]/50 transition-colors" : ""}`}
    >
      {issueKey && (
        <span className="shrink-0 font-mono text-[11px] text-[#a19d90]">{issueKey}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] text-[#20201d]">{title}</span>
      {right && <div className="flex shrink-0 items-center gap-2.5">{right}</div>}
    </Wrapper>
  );
}
