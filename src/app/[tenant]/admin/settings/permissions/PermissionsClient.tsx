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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none ${
        checked ? "bg-green-500" : "bg-neutral-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

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
  const isOn = value;

  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-neutral-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-900">{meta.label}</span>
          {isDefault ? (
            <span className="text-[10px] uppercase tracking-wide text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">
              Default
            </span>
          ) : (
            <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${
              isOn ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              {isOn ? "Enabled" : "Restricted"}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">{meta.description}</p>
      </div>
      <Toggle checked={value} onChange={onChange} />
    </div>
  );
}

function RoleCard({
  title,
  description,
  badge,
  badgeColor,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900">{title}</p>
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${badgeColor}`}>{badge}</span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-5">{children}</div>
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Permissions</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Control what members and viewers can do in this workspace. Owners and admins always have full access.
        </p>
      </div>

      {/* Always-full banner */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3 flex items-center gap-3">
        <span className="text-lg">🛡</span>
        <p className="text-sm text-indigo-800">
          <strong>Owners</strong> and <strong>Admins</strong> always have full access regardless of these settings.
        </p>
      </div>

      <RoleCard
        title="Viewer role"
        description="Read-only by default — loosen these to let viewers participate more."
        badge="Read-only"
        badgeColor="bg-neutral-100 text-neutral-600"
      >
        {VIEWER_KEYS.map((key) => (
          <PermissionRow key={key} permKey={key} value={effective(key)} onChange={(v) => set(key, v)} />
        ))}
      </RoleCard>

      <RoleCard
        title="Member role"
        description="Members can create and edit issues. Enable extras below to grant more capabilities."
        badge="Standard"
        badgeColor="bg-blue-50 text-blue-700"
      >
        {MEMBER_KEYS.map((key) => (
          <PermissionRow key={key} permKey={key} value={effective(key)} onChange={(v) => set(key, v)} />
        ))}
      </RoleCard>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {isPending ? "Saving…" : "Save permissions"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-semibold text-neutral-800 mb-3">How it works</p>
        <ul className="space-y-2 text-sm text-neutral-600">
          <li className="flex items-start gap-2"><span className="text-neutral-400 mt-0.5">•</span> Changes take effect immediately — no restart needed</li>
          <li className="flex items-start gap-2"><span className="text-neutral-400 mt-0.5">•</span> Owners and admins are always unrestricted</li>
          <li className="flex items-start gap-2"><span className="text-neutral-400 mt-0.5">•</span> Viewers cannot be granted member-only capabilities (like delete)</li>
        </ul>
      </div>
    </div>
  );
}
