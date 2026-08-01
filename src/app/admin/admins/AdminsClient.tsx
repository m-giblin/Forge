"use client";

import { useState, useTransition } from "react";
import type { SuperAdminRow } from "./page";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import Note from "@/components/patterns/admin/Note";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

function initials(row: SuperAdminRow) {
  const name = row.display_name ?? row.user?.name ?? row.user?.email ?? "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function displayLabel(row: SuperAdminRow) {
  return row.display_name ?? row.user?.name ?? row.user?.email ?? "—";
}

// ── Profile slide-over ────────────────────────────────────────────────────────

function ProfilePanel({
  admin, isMe, lastLogin, onClose, onSave, onRevoke,
}: {
  admin: SuperAdminRow;
  isMe: boolean;
  lastLogin: string | null;
  onClose: () => void;
  onSave: (userId: string, patch: Partial<SuperAdminRow>) => Promise<string | null>;
  onRevoke: (userId: string, email: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    display_name: admin.display_name ?? "",
    phone: admin.phone ?? "",
    cell: admin.cell ?? "",
    alt_email: admin.alt_email ?? "",
    notes: admin.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    const err = await onSave(admin.user_id, form);
    setSaving(false);
    if (err) { setError(err); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const email = admin.user?.email ?? "—";

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: "1px solid #e5e7eb", fontSize: 12, color: "#111827",
    outline: "none", background: "#fff", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 700,
    color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }} onClick={onClose}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.35)" }} />
      <div
        style={{ width: "100%", maxWidth: 420, background: "#fff", borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#c9791d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {initials(admin)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{displayLabel(admin)}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: "4px 6px" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Access info */}
          <div style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 9 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em" }}>Access granted</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 2 }}>{timeAgo(admin.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em" }}>Last login</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 2 }}>
                    {lastLogin ? new Date(lastLogin).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  </div>
                </div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 9, background: "#f4ead4", color: "#8a4f13", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>Super Admin</span>
            </div>
          </div>

          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={labelStyle}>Display Name</label><input style={inputStyle} value={form.display_name} onChange={field("display_name")} placeholder="e.g. Matt Giblin" /></div>
            <div><label style={labelStyle}>Primary Email</label><input style={{ ...inputStyle, background: "#f8fafc", color: "#94a3b8" }} value={email} disabled /></div>
            <div><label style={labelStyle}>Alternative Email</label><input style={inputStyle} type="email" value={form.alt_email} onChange={field("alt_email")} placeholder="backup@example.com" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={labelStyle}>Phone (office)</label><input style={inputStyle} type="tel" value={form.phone} onChange={field("phone")} placeholder="+1 (555) 000-0000" /></div>
              <div><label style={labelStyle}>Cell / Mobile</label><input style={inputStyle} type="tel" value={form.cell} onChange={field("cell")} placeholder="+1 (555) 000-0000" /></div>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={form.notes}
                onChange={field("notes")}
                placeholder="e.g. Primary on-call contact, backup for compliance reviews…"
                rows={3}
                style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {error && <div style={{ padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>{error}</div>}
          {saved && <div style={{ padding: "9px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 12, color: "#059669" }}>Profile saved.</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          {!isMe ? (
            <button onClick={() => onRevoke(admin.user_id, email)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              Revoke access
            </button>
          ) : (
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>Cannot revoke your own access</span>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#f8fafc", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "#c9791d", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving ? .5 : 1 }}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminsClient({
  initialAdmins,
  currentUserId,
  lastLoginMap = {},
}: {
  initialAdmins: SuperAdminRow[];
  currentUserId: string;
  lastLoginMap?: Record<string, string | null>;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [selected, setSelected] = useState<SuperAdminRow | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);

  async function refreshList() {
    const res = await fetch("/api/admin/super-admins");
    const json = await res.json();
    setAdmins(json.data ?? []);
  }

  async function invite() {
    setError(null); setSuccess(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/super-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed"); return; }
      await refreshList();
      setSuccess(`Invitation sent to ${email.trim()}.`);
      setEmail(""); setName("");
    });
  }

  async function saveProfile(userId: string, patch: Partial<SuperAdminRow>): Promise<string | null> {
    const res = await fetch("/api/admin/super-admins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    const json = await res.json();
    if (!res.ok) return json.error ?? "Failed to save";
    setAdmins((prev) => prev.map((a) => a.user_id === userId ? { ...a, ...patch } : a));
    if (selected?.user_id === userId) setSelected((s) => s ? { ...s, ...patch } : s);
    return null;
  }

  async function revoke(userId: string, userEmail: string) {
    if (!confirm(`Revoke platform admin access for ${userEmail}?`)) return;
    setRevoking(userId);
    setError(null);
    const res = await fetch("/api/admin/super-admins", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed"); setRevoking(null); return; }
    setAdmins((prev) => prev.filter((a) => a.user_id !== userId));
    setSelected(null);
    setRevoking(null);
  }

  // suppress unused var warning
  void revoking;

  const columns = [
    { label: "Name", flex: true },
    { label: "Email", width: 250 },
    { label: "Access", width: 160 },
    { label: "Last active", width: 150 },
    { label: "", width: 90 },
  ];
  const tableRows: AdminTableCell[][] = admins.map((a) => {
    const isMe = a.user_id === currentUserId;
    const label = displayLabel(a);
    const emailStr = a.user?.email ?? "—";
    return [
      {
        kind: "text",
        value: (
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c9791d] text-[10px] font-bold text-white">{initials(a)}</span>
            <span className="truncate font-bold text-[#20201d]">{label}</span>
            {isMe && <span className="shrink-0 rounded-full bg-[#f4ead4] px-1.5 py-[1px] text-[9px] font-bold text-[#8a4f13]">you</span>}
          </span>
        ),
      },
      { kind: "mono", value: emailStr },
      { kind: "chip", value: "Super Admin", chipFg: "#8a4f13", chipBg: "#f4ead4" },
      { kind: "dim", value: `granted ${timeAgo(a.created_at)}` },
      { kind: "link", value: "Manage", onClick: () => setSelected(a) },
    ];
  });

  return (
    <div className="space-y-4">
      {/* Admin list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-[#20201d]">Current platform admins</h2>
          <span className="text-[11px] text-[#a19d90]">{admins.length} account{admins.length !== 1 ? "s" : ""}</span>
        </div>
        {admins.length === 0 ? (
          <div className="fw-card py-6 text-center text-[12px] text-[#a19d90]">No admins found.</div>
        ) : (
          <AdminTable columns={columns} rows={tableRows} minWidth={800} />
        )}
      </div>

      {/* Grant access */}
      <div className="fw-card px-3.5 py-3">
        <h2 className="mb-2.5 text-[12.5px] font-bold text-[#20201d]">Grant platform access</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email && invite()}
            suppressHydrationWarning
            className="min-w-[180px] flex-[2] rounded-md border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] outline-none focus:border-[#c9791d]"
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email && invite()}
            className="min-w-[140px] flex-1 rounded-md border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] outline-none focus:border-[#c9791d]"
          />
          <button
            onClick={invite}
            disabled={!email.trim() || isPending}
            className="whitespace-nowrap rounded-md border border-[#c9791d] bg-[#c9791d] px-4 py-[7px] text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Invite & Grant"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#a19d90]">
          New users receive an invitation email to set their password. Existing users get access immediately. You can fill in their full profile after adding them.
        </p>
        {error && <div className="mt-2.5"><Note icon="⚠" tone="error">{error}</Note></div>}
        {success && <div className="mt-2.5"><Note icon="✓" tone="info">{success}</Note></div>}
      </div>

      {selected && (
        <ProfilePanel
          admin={selected}
          isMe={selected.user_id === currentUserId}
          lastLogin={lastLoginMap[selected.user_id] ?? null}
          onClose={() => setSelected(null)}
          onSave={saveProfile}
          onRevoke={async (userId, userEmail) => { await revoke(userId, userEmail); }}
        />
      )}
    </div>
  );
}
