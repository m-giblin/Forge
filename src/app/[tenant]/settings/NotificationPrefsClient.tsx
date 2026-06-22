"use client";

import { useState, useTransition } from "react";
import { saveNotificationPrefsAction } from "./actions";

const NOTIF_TYPES = [
  { key: "issue_assigned",    label: "Issue assigned to me" },
  { key: "issue_mentioned",   label: "Mentioned in an issue" },
  { key: "issue_commented",   label: "Comment on my issue" },
  { key: "issue_status",      label: "Issue status changed" },
  { key: "digest",            label: "Daily digest email" },
  { key: "idea_commented",    label: "Comment on my idea" },
  { key: "idea_status",       label: "Idea status changed" },
  { key: "support_update",    label: "Support ticket update" },
];

export default function NotificationPrefsClient({
  slug,
  initialPrefs,
}: {
  slug: string;
  initialPrefs: Record<string, boolean>;
}) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveNotificationPrefsAction(slug, prefs);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  const isEnabled = (key: string) => prefs[key] !== false;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {NOTIF_TYPES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-neutral-700">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled(key)}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isEnabled(key) ? "bg-neutral-900" : "bg-neutral-200"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 translate-x-0.5 transform rounded-full bg-white shadow transition-transform ${
                  isEnabled(key) ? "translate-x-[18px]" : ""
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save preferences"}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Saved</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <p className="text-xs text-neutral-400">
        Toggling off a type suppresses in-app notifications. Email digest is separate.
        These preferences require migration 0067 — if the column is missing, changes won&apos;t persist.
      </p>
    </div>
  );
}
