export default function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** optional accent hex applied to the value text, e.g. red for an alert stat */
  color?: string;
}) {
  return (
    <div className="fw-card px-3.5 py-3">
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#726e60]">
        {label}
      </p>
      <p
        className="mt-1 text-[23px] font-extrabold font-[family-name:var(--font-manrope)]"
        style={{ color: color ?? "#20201d" }}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-[#a19d90]">{hint}</p>}
    </div>
  );
}
