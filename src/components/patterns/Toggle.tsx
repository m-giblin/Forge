export default function Toggle({
  on,
  onChange,
  platform = false,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  platform?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 34,
        height: 19,
        backgroundColor: on ? (platform ? "#c9791d" : "#8c4632") : "#cfc9b9",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-[left]"
        style={{ width: 15, height: 15, top: 2, left: on ? 17 : 2, transitionDuration: "120ms" }}
      />
    </button>
  );
}
