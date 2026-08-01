"use client";

import { useState, useTransition } from "react";
import {
  type PermissionKey,
  type PermissionOverrides,
  PERMISSION_DEFAULTS,
  PERMISSION_META,
} from "@/lib/permissions";
import { savePermissionOverridesAction } from "./actions";
import TogglesList from "@/components/patterns/admin/TogglesList";
import Note from "@/components/patterns/admin/Note";

const MEMBER_KEYS: PermissionKey[] = [
  "member.delete_issue",
  "member.manage_projects",
  "member.invite_members",
  "member.manage_fields",
];

const VIEWER_KEYS: PermissionKey[] = [
  "viewer.create_issue",
  "viewer.comment",
  "viewer.close_issue",
];

export default function PermissionsClient({
  slug,
  initial,
}: {
  slug: string;
  initial: PermissionOverrides;
}) {
  const [overrides, setOverrides] = useState<PermissionOverrides>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function effective(key: PermissionKey): boolean {
    return overrides[key] ?? PERMISSION_DEFAULTS[key];
  }

  function set(key: string, value: boolean) {
    setSaved(false);
    setOverrides((prev) => ({ ...prev, [key as PermissionKey]: value }));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await savePermissionOverridesAction(slug, overrides);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">Member</h2>
        <TogglesList
          items={MEMBER_KEYS.map((key) => ({
            key,
            label: PERMISSION_META[key].label,
            description: PERMISSION_META[key].description,
            on: effective(key),
          }))}
          onChange={set}
        />
      </div>

      <div>
        <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">Viewer</h2>
        <TogglesList
          items={VIEWER_KEYS.map((key) => ({
            key,
            label: PERMISSION_META[key].label,
            description: PERMISSION_META[key].description,
            on: effective(key),
          }))}
          onChange={set}
        />
      </div>

      <Note icon="ℹ" tone="info">
        Admin always has every permission. Changes here apply immediately to all members.
      </Note>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
          style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
        >
          {isPending ? "Saving…" : "Save permissions"}
        </button>
        {saved && <span className="text-[12px] font-semibold text-[#4b7a4f]">Saved</span>}
        {error && <span className="text-[12px] font-semibold text-[#c0392b]">{error}</span>}
      </div>
    </div>
  );
}
