"use client";

/** §3.2 `deck` block — estimation-poker card deck (60×82px cards). */
export default function PokerDeck({
  values,
  selected,
  onSelect,
}: {
  values: (number | string)[];
  selected?: number | string | null;
  onSelect?: (value: number | string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {values.map((value) => {
        const isSelected = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect?.(value)}
            className="flex shrink-0 items-center justify-center rounded-[7px] border text-[18px] font-extrabold font-[family-name:var(--font-manrope)] transition-transform"
            style={{
              width: 60,
              height: 82,
              borderColor: isSelected ? "#8c4632" : "#ddd8c9",
              backgroundColor: isSelected ? "#8c4632" : "#f4f2eb",
              color: isSelected ? "#f2e9d8" : "#20201d",
              transform: isSelected ? "translateY(-4px)" : undefined,
            }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
