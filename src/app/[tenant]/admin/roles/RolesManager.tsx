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
import AdminList from "@/components/patterns/admin/AdminList";
import FormGrid from "@/components/patterns/admin/FormGrid";

type Props = {
  slug: string;
  initialRoles: (CustomRole & { memberCount: number })[];
  /** The live permission catalog from permission_definitions — not a hardcoded list, so a permission added via /admin/permissions shows up here with no deploy. */
  permissions: PermissionDefinition[];
};

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {ROLE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded-full border-2 transition-transform ${
            COLOR_CLASSES[c as RoleColor].bg
          } ${value === c ? "border-[#5e2c1f] scale-110" : "border-transparent"}`}
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
    <div className="max-h-64 space-y-3 overflow-auto rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] p-2.5">
      {groups.map((group) => {
        const perms = permissions.filter((p) => p.groupName === group);
        return (
          <div key={group}>
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">{group}</p>
            <div className="space-y-0.5">
              {perms.map((perm) => (
                <label key={perm.key} className="flex cursor-pointer items-center justify-between rounded-[5px] px-2 py-1.5 hover:bg-[#eae6da]">
                  <span>
                    <span className="text-[12px] font-semibold text-[#20201d]">{perm.label}</span>
                    <span className="ml-2 text-[11px] text-[#a19d90]">{perm.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={value[perm.key] ?? false}
                    onChange={() => toggle(perm.key)}
                    className="h-3.5 w-3.5 accent-[#8c4632]"
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
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cc.bg} ${cc.text} ${cc.border}`}>
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

const fieldClass =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] outline-none focus:border-[#b7452f]";

function RoleForm({
  title,
  initial,
  onSave,
  onCancel,
  pending,
  permissions,
}: {
  title: string;
  initial: FormState;
  onSave: (s: FormState) => void;
  onCancel: () => void;
  pending: boolean;
  permissions: PermissionDefinition[];
}) {
  const [form, setForm] = useState(initial);
  return (
    <div>
      <p className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">{title}</p>
      <FormGrid
        fields={[
          {
            key: "name",
            label: "Role name",
            input: (
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sprint Master"
                className={fieldClass}
              />
            ),
          },
          {
            key: "description",
            label: "Description",
            input: (
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional note about this role"
                className={fieldClass}
              />
            ),
          },
          {
            key: "color",
            label: "Color",
            input: <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />,
          },
          {
            key: "permissions",
            label: "Permissions",
            input: <PermissionsGrid value={form.permissions} onChange={(p) => setForm((f) => ({ ...f, permissions: p }))} permissions={permissions} />,
          },
        ]}
        onCancel={onCancel}
        onSubmit={() => { if (form.name.trim()) onSave(form); }}
        submitLabel={pending ? "Saving…" : "Save role"}
      />
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

  const editingRole = roles.find((r) => r.id === editingId);
  const listRoles = roles.filter((r) => r.id !== editingId);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-[5px] border border-[#f0cfc9] bg-[#fbeae8] px-3 py-2 text-[12px] font-semibold text-[#c0392b]">{error}</p>}

      {editingRole && (
        <RoleForm
          title={`Edit "${editingRole.name}"`}
          initial={{ name: editingRole.name, description: editingRole.description ?? "", color: editingRole.color, permissions: editingRole.permissions }}
          pending={pending}
          permissions={permissions}
          onCancel={() => setEditingId(null)}
          onSave={(form) =>
            run(
              () => updateRoleAction(slug, editingRole.id, { name: form.name, description: form.description, color: form.color, permissions: form.permissions }),
              () => {
                setRoles((prev) => prev.map((r) => (r.id === editingRole.id ? { ...r, ...form } : r)));
                setEditingId(null);
              }
            )
          }
        />
      )}

      {listRoles.length > 0 && (
        <AdminList
          items={listRoles.map((role) => ({
            key: role.id,
            title: <RoleChip role={role} />,
            subline: role.description || undefined,
            meta: `${role.memberCount} member${role.memberCount !== 1 ? "s" : ""} · ${countGranted(role.permissions)} perm${countGranted(role.permissions) !== 1 ? "s" : ""}`,
            actionLabel: role.is_system ? "Edit" : "Edit",
            onAction: () => setEditingId(role.id),
          }))}
        />
      )}

      {roles.length === 0 && !creating && (
        <p className="text-center text-[12px] text-[#a19d90]">
          No custom roles yet. Create one below and assign it to members.
        </p>
      )}

      {creating ? (
        <RoleForm
          title="New role"
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
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-[#ddd8c9] px-4 py-3 text-[12px] font-semibold text-[#726e60] hover:border-[#b7452f]/50 hover:text-[#b7452f]"
        >
          + New custom role
        </button>
      )}
    </div>
  );
}
