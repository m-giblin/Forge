"use client";

import { useState, useTransition } from "react";
import type { PermissionDefinition } from "@/lib/repositories/permissionDefinitions";
import { createPermissionAction, updatePermissionAction } from "./actions";

function Toggle({ on, disabled, onToggle }: { on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label="toggle"
      style={{
        position: "relative", width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0,
        background: on ? "#10b981" : "#d1d5db", opacity: disabled ? 0.5 : 1, transition: "background .15s",
      }}
    >
      <span style={{ position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .15s", left: on ? 18 : 2 }} />
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 9px", fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb", outline: "none",
};

export default function PermissionsConsole({ initial }: { initial: PermissionDefinition[] }) {
  const [permissions, setPermissions] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", label: "", description: "", groupName: "" });

  const groups = Array.from(new Set(permissions.map((p) => p.groupName))).sort();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function toggleField(key: string, field: "memberDefault" | "viewerDefault" | "isActive", value: boolean) {
    setPermissions((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
    run(() => updatePermissionAction(key, { [field]: value }));
  }

  function createPermission() {
    if (!form.key.trim() || !form.label.trim() || !form.groupName.trim()) {
      setError("Key, label, and group are required.");
      return;
    }
    const newDef: PermissionDefinition = {
      key: form.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      label: form.label.trim(),
      description: form.description.trim(),
      groupName: form.groupName.trim(),
      memberDefault: false,
      viewerDefault: false,
      isActive: true,
    };
    run(async () => {
      await createPermissionAction(newDef);
      setPermissions((prev) => [...prev, newDef]);
      setForm({ key: "", label: "", description: "", groupName: "" });
      setShowForm(false);
    });
  }

  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 16 };
  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: "1px solid #f1f5f9" };

  return (
    <div>
      {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#991b1b" }}>{error}</div>}

      {groups.map((group) => (
        <div key={group} style={cardStyle}>
          <div style={{ padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>
            {group}
          </div>
          {permissions.filter((p) => p.groupName === group).map((p) => (
            <div key={p.key} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.label}</span>
                  <code style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>{p.key}</code>
                  {!p.isActive && <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626" }}>INACTIVE</span>}
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{p.description}</p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
                Member default
                <Toggle on={p.memberDefault} disabled={isPending} onToggle={() => toggleField(p.key, "memberDefault", !p.memberDefault)} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
                Viewer default
                <Toggle on={p.viewerDefault} disabled={isPending} onToggle={() => toggleField(p.key, "viewerDefault", !p.viewerDefault)} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
                Active
                <Toggle on={p.isActive} disabled={isPending} onToggle={() => toggleField(p.key, "isActive", !p.isActive)} />
              </label>
            </div>
          ))}
        </div>
      ))}

      {showForm ? (
        <div style={{ ...cardStyle, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>New permission</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input placeholder="key (e.g. manage_okrs)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} style={inputStyle} />
            <input placeholder="Group (e.g. Strategy)" value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} style={inputStyle} />
            <input placeholder="Label (e.g. Manage OKRs)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} style={inputStyle} />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createPermission} disabled={isPending} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: "#111827", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
              {isPending ? "Creating…" : "Create"}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: "6px 14px", fontSize: 12, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: "8px 16px", fontSize: 12, fontWeight: 700, background: "#fff", border: "1px dashed #d1d5db", borderRadius: 8, color: "#6b7280", cursor: "pointer" }}
        >
          + Add permission
        </button>
      )}
    </div>
  );
}
