import StatCard from "../StatCard";

/** §3.2 `stats` block — row of 2–4 stat cards. */
export default function StatsRow({
  items,
}: {
  items: { label: string; value: string | number; hint?: string; color?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} color={item.color} />
      ))}
    </div>
  );
}
