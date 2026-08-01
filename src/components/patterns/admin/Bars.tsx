/** §3.2 `bars` block — labeled bar chart. */
export default function Bars({
  items,
  color = "#8c4632",
}: {
  items: { label: string; value: number; max?: number; hint?: string }[];
  color?: string;
}) {
  const max = Math.max(...items.map((i) => i.max ?? i.value), 1);
  return (
    <div className="fw-card flex flex-col gap-3 px-4 py-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[11.5px] text-[#4a473e]">{item.label}</span>
          <div className="h-2 flex-1 min-w-0 overflow-hidden rounded-full bg-[#e3ded0]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (item.value / max) * 100)}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-[11.5px] font-bold text-[#20201d]">
            {item.hint ?? item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
