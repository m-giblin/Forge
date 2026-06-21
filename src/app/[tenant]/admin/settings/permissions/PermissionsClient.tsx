"use client";

import { useState, useTransition } from "react";
import {
  type PermissionKey,
  type PermissionOverrides,
  PERMISSION_DEFAULTS,
  PERMISSION_META,
} from "@/lib/permissions";
import { savePermissionOverridesAction } from "./actions";

const VIEWER_KEYS: PermissionKey[] = [
  "viewer.create_issue",
  "viewer.comment",
  "viewer.close_issue",
];

const MEMBER_KEYS: PermissionKey[] = [
  "member.delete_issue",
  "member.manage_projects",
  "member.invite_members",
  "member.manage_fields",
];

function PermissionRow({
  permKey,
  value,
  onChange,
}: {
  permKey: PermissionKey;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const meta = PERMISSION_META[permKey];
  const isDefault = value === PERMISSION_DEFAULTS[permKey];

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-zinc-800 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{meta.label}</span>
          {isDefault && (
            <span className="text-[10px] uppercase tracking-wide text-zinc-500 border border-zinc-700 rounded px-1">
              default
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">{meta.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none ${
          value ? "bg-green-600" : "bg-zinc-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

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

  function set(key: PermissionKey, value: boolean) {
    setSaved(false);
    setOverrides((prev) => ({ ...prev, [key]: value }));
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
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Permissions</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Control what members and viewers can do in this workspace. Owners and admins always have full access.
        </p>
      </div>

      {/* Viewer permissions */}
      <div className="border border-zinc-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-zinc-800/60 border-b border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-200">Viewer role</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Read-only by default — loosen these to let viewers participate more.</p>
        </div>
        <div className="px-4 bg-zinc-900/40">
          {VIEWER_KEYS.map((key) => (
            <PermissionRow key={key} permKey={key} value={effective(key)} onChange={(v) => set(key, v)} />
          ))}
        </div>
      </div>

      {/* Member permissions */}
      <div className="border border-zinc-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-zinc-800/60 border-b border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-200">Member role</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Members can create and edit issues. Enable extras below to grant more capabilities.</p>
        </div>
        <div className="px-4 bg-zinc-900/40">
          {MEMBER_KEYS.map((key) => (
            <PermissionRow key={key} permKey={key} value={effective(key)} onChange={(v) => set(key, v)} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md"
        >
          {isPending ? "Saving…" : "Save permissions"}
        </button>
        {saved && <span className="text-sm text-green-400">Saved ✓</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      <div className="border border-zinc-800 rounded-lg p-4 text-xs text-zinc-500 space-y-1">
        <p className="font-semibold text-zinc-400">How it works</p>
        <p>• Changes take effect immediately — no restart needed</p>
        <p>• Owners and admins are always unrestricted</p>
        <p>• Viewers cannot be granted member-only capabilities (like delete)</p>
      </div>
    </div>
  );
}
