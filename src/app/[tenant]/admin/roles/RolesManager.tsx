"use client";

import { useState, useTransition } from "react";
import {
  ROLE_COLORS,
  COLOR_CLASSES,
  type CustomRole,
  type RbacPermissionSet,
  type RoleColor,
} from "@/lib/rbac";
import type { PermissionDefinition } from "@/lib/repositories/permissionDefinitions";
import { createRoleAction, updateRoleAction, deleteRoleAction } from "./actions";

type Props = {
  slug: string;
  initialRoles: (CustomRole & { memberCount: number })[];
  /** The live permission catalog from permission_definitions — not a hardcoded list, so a permission added via /admin/permissions shows up here with no deploy. */
  permissions: PermissionDefinition[];
};

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {ROLE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded-full border-2 transition-transform ${
            COLOR_CLASSES[c as RoleColor].bg
          } ${value === c ? "border-neutral-700 scale-110" : "border-transparent"}`}
          title={c}
        />
      ))}
    </div>
  );
}

function PermissionsGrid({
  value,
  onChange,
  permissions,
}: {
  value: RbacPermissionSet;
  onChange: (p: RbacPermissionSet) => void;
  permissions: PermissionDefinition[];
}) {
  const toggle = (perm: string) => {
    onChange({ ...value, [perm]: !value[perm] });
  };
  const groups = Array.from(new Set(permissions.map((p) => p.groupName)));
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const perms = permissions.filter((p) => p.groupName === group);
        return (
          <div key={group}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{group}</p>
            <div className="space-y-1">
              {perms.map((perm) => (
                <label key={perm.key} className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 hover:bg-neutral-50">
                  <span>
                    <span className="text-sm font-medium text-neutral-700">{perm.label}</span>
                    <span className="ml-2 text-xs text-neutral-400">{perm.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={value[perm.key] ?? false}
                    onChange={() => toggle(perm.key)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleChip({ role }: { role: CustomRole }) {
  const cc = COLOR_CLASSES[role.color as RoleColor] ?? COLOR_CLASSES.indigo;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cc.bg} ${cc.text} ${cc.border}`}>
      {role.name}
    </span>
  );
}

type FormState = {
  name: string;
  description: string;
  color: string;
  permissions: RbacPermissionSet;
};

function RoleForm({
  initial,
  onSave,
  onCancel,
  pending,
  permissions,
}: {
  initial: FormState;
  onSave: (s: FormState) => void;
  onCancel: () => void;
  pending: boolean;
  permissions: PermissionDefinition[];
}) {
  const [form, setForm] = useState(initial);
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Role name *</label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Sprint Master"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional note about this role"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-neutral-600">Color</label>
        <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-neutral-600">Permissions</label>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <PermissionsGrid value={form.permissions} onChange={(p) => setForm((f) => ({ ...f, permissions: p }))} permissions={permissions} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={pending} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { if (form.name.trim()) onSave(form); }}
          disabled={pending || !form.name.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save role"}
        </button>
      </div>
    </div>
  );
}

export default function RolesManager({ slug, initialRoles, permissions }: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyPerms: RbacPermissionSet = Object.fromEntries(permissions.map((p) => [p.key, false]));
  const countGranted = (perms: RbacPermissionSet) => permissions.filter((p) => perms[p.key]).length;

  function run(fn: () => Promise<unknown>, then?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        then?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Existing roles */}
      {roles.map((role) => (
        <div key={role.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {editingId === role.id ? (
            <div className="p-4">
              <p className="mb-3 text-sm font-semibold text-neutral-700">Edit role</p>
              <RoleForm
                initial={{ name: role.name, description: role.description ?? "", color: role.color, permissions: role.permissions }}
                pending={pending}
                permissions={permissions}
                onCancel={() => setEditingId(null)}
                onSave={(form) =>
                  run(
                    () => updateRoleAction(slug, role.id, { name: form.name, description: form.description, color: form.color, permissions: form.permissions }),
                    () => {
                      setRoles((prev) => prev.map((r) => r.id === role.id ? { ...r, ...form } : r));
                      setEditingId(null);
                    }
                  )
                }
              />
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <RoleChip role={role} />
                <span className="text-xs text-neutral-400">
                  {role.description && <span className="mr-2 text-neutral-500">{role.description}</span>}
                  {role.memberCount} member{role.memberCount !== 1 ? "s" : ""}
                  {" · "}
                  {countGranted(role.permissions)} permission{countGranted(role.permissions) !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(role.id)}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Edit
                </button>
                {!role.is_system && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete role "${role.name}"?`)) {
                        run(
                          () => deleteRoleAction(slug, role.id),
                          () => setRoles((prev) => prev.filter((r) => r.id !== role.id))
                        );
                      }
                    }}
                    disabled={pending}
                    className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Create new role */}
      {creating ? (
        <div className="rounded-xl border border-indigo-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-neutral-700">New custom role</p>
          <RoleForm
            initial={{ name: "", description: "", color: "indigo", permissions: { ...emptyPerms } }}
            pending={pending}
            permissions={permissions}
            onCancel={() => setCreating(false)}
            onSave={(form) =>
              run(
                () => createRoleAction(slug, { name: form.name, description: form.description, color: form.color, permissions: form.permissions }),
                () => {
                  setRoles((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), tenant_id: "", is_system: false, created_at: new Date().toISOString(), memberCount: 0, ...form },
                  ]);
                  setCreating(false);
                }
              )
            }
          />
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
        >
          + New custom role
        </button>
      )}

      {roles.length === 0 && !creating && (
        <p className="text-center text-sm text-neutral-400">
          No custom roles yet. Create one above and assign it to members.
        </p>
      )}
    </div>
  );
}
