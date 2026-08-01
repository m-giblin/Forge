import type { ReactNode } from "react";

type CellKind = "text" | "mono" | "dim" | "bold" | "link" | "chip";

export type AdminTableCell = {
  kind?: CellKind;
  value: ReactNode;
  /** chip color hex, only used when kind === "chip" */
  chipFg?: string;
  chipBg?: string;
  onClick?: () => void;
};

/** §3.2 `table` block — header + data rows; cells typed mono/dim/bold/link/[color] chip. */
export default function AdminTable({
  columns,
  rows,
  minWidth,
}: {
  columns: { label: string; width?: number; flex?: boolean }[];
  rows: AdminTableCell[][];
  minWidth?: number;
}) {
  return (
    <div className="fw-card overflow-auto" style={minWidth ? { minWidth } : undefined}>
      <div className="min-w-fit">
        <div
          className="flex items-center gap-3 border-b border-[#ddd8c9] bg-[#eae6da] px-3.5 py-2"
          style={minWidth ? { minWidth } : undefined}
        >
          {columns.map((col) => (
            <span
              key={col.label}
              className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]"
              style={col.flex ? { flex: 1, minWidth: 0 } : { width: col.width ?? 100 }}
            >
              {col.label}
            </span>
          ))}
        </div>
        {rows.map((row, ri) => (
          <div
            key={ri}
            className={`flex items-center gap-3 px-3.5 py-[11px] ${ri > 0 ? "border-t border-[#e3ded0]" : ""}`}
            style={minWidth ? { minWidth } : undefined}
          >
            {row.map((cell, ci) => (
              <Cell key={ci} cell={cell} col={columns[ci]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ cell, col }: { cell: AdminTableCell; col: { width?: number; flex?: boolean } }) {
  const style = col.flex ? { flex: 1, minWidth: 0 } : { width: col.width ?? 100, flexShrink: 0 };
  const kind = cell.kind ?? "text";

  if (kind === "chip") {
    return (
      <span style={style}>
        <span
          className="inline-block rounded-full px-2 py-[3px] text-[11px] font-semibold"
          style={{ color: cell.chipFg ?? "#4a473e", backgroundColor: cell.chipBg ?? "#f1efe9" }}
        >
          {cell.value}
        </span>
      </span>
    );
  }

  const classes: Record<CellKind, string> = {
    text: "text-[12.5px] text-[#20201d]",
    mono: "font-mono text-[11px] text-[#726e60]",
    dim: "text-[11.5px] text-[#a19d90]",
    bold: "text-[12.5px] font-bold text-[#20201d]",
    link: "text-[12.5px] font-semibold text-[#b7452f] hover:underline",
    chip: "",
  };

  if (kind === "link" && cell.onClick) {
    return (
      <button type="button" onClick={cell.onClick} className={`truncate text-left ${classes.link}`} style={style}>
        {cell.value}
      </button>
    );
  }

  return (
    <span className={`truncate ${classes[kind]}`} style={style}>
      {cell.value}
    </span>
  );
}
