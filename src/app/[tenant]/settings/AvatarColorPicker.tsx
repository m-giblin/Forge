"use client";

import { useState, useTransition } from "react";
import { saveAvatarColorAction } from "./actions";
import { avatarColor, initials, AVATAR_COLOR_CHOICES } from "@/lib/ui/avatar";

export default function AvatarColorPicker({
  slug,
  userId,
  name,
  initialColor,
}: {
  slug: string;
  userId: string;
  name: string;
  initialColor: string | null;
}) {
  const [color, setColor] = useState<string | null>(initialColor);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(next: string) {
    setColor(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await saveAvatarColorAction(slug, next);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  const previewColor = avatarColor(userId, color);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: previewColor }}
        >
          {initials(name)}
        </span>
        <div>
          <p className="text-sm font-medium text-neutral-800">{name}</p>
          <p className="text-xs text-neutral-500">Shown on tickets you&apos;re assigned to</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {AVATAR_COLOR_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => choose(c)}
            disabled={isPending}
            aria-label={`Choose avatar color ${c}`}
            className="h-7 w-7 rounded-full transition disabled:opacity-50"
            style={{
              backgroundColor: c,
              boxShadow: color === c ? "0 0 0 2px white, 0 0 0 4px #20201d" : "none",
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        {saved && <span className="text-xs text-green-600">✓ Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
