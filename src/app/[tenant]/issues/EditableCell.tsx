"use client";

import { useState, useTransition } from "react";

type Option = { key: string; label: string; color?: string | null };

/** Shared "saved" flash + pending-disabled wrapper for one inline-editable cell. */
function useCellSave(onSave: (value: string) => Promise<void>) {
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);

  function save(value: string) {
    startTransition(async () => {
      try {
        await onSave(value);
        setFlash("saved");
      } catch {
        setFlash("error");
      } finally {
        setTimeout(() => setFlash(null), 1200);
      }
    });
  }

  return { pending, flash, save };
}

function FlashRing({ flash, children }: { flash: "saved" | "error" | null; children: React.ReactNode }) {
  return (
    <div
      className={`rounded transition-shadow ${
        flash === "saved" ? "ring-2 ring-[#3f7d4c]/50" : flash === "error" ? "ring-2 ring-[#c0392b]/50" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function EditableSelectCell({
  value,
  options,
  onSave,
  placeholder,
  disabled,
}: {
  value: string;
  options: Option[];
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { pending, flash, save } = useCellSave(onSave);
  return (
    <FlashRing flash={flash}>
      <select
        value={value}
        disabled={disabled || pending}
        onChange={(e) => save(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-[#4a473e] hover:bg-[#f1efe9] focus:bg-white focus:outline focus:outline-1 focus:outline-[#3a6ea8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </FlashRing>
  );
}

export function EditableTextCell({
  value,
  onSave,
  type = "text",
  disabled,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: "text" | "number" | "date";
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const { pending, flash, save } = useCellSave(onSave);

  function commit() {
    if (draft !== value) save(draft);
  }

  return (
    <FlashRing flash={flash}>
      <input
        type={type}
        value={draft}
        disabled={disabled || pending}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-[#4a473e] hover:bg-[#f1efe9] focus:bg-white focus:outline focus:outline-1 focus:outline-[#3a6ea8] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </FlashRing>
  );
}
