"use client";

import { useState, useTransition } from "react";
import type { SuperAdminRow } from "./page";

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
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
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
              <span style={{ padding: "3px 10px", borderRadius: 9, background: "#fffbeb", color: "#d97706", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>Super Admin</span>
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
            <button onClick={save} disabled={saving} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving ? .5 : 1 }}>
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

  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 14 };
  const cardHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid #f1f5f9" };
  const inputStyle: React.CSSProperties = { padding: "7px 10px", borderRadius: 7, border: "1px solid #e5e7eb", fontSize: 12, color: "#111827", outline: "none", background: "#fff" };

  return (
    <div>
      {/* Admin list */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Current platform admins</span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{admins.length} account{admins.length !== 1 ? "s" : ""}</span>
        </div>
        {admins.length === 0 ? (
          <p style={{ padding: "24px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No admins found.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {admins.map((a) => {
              const isMe = a.user_id === currentUserId;
              const label = displayLabel(a);
              const emailStr = a.user?.email ?? "—";
              const hasProfile = a.phone || a.cell || a.alt_email || a.notes;
              return (
                <li
                  key={a.user_id}
                  onClick={() => setSelected(a)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {initials(a)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</span>
                      {isMe && <span style={{ padding: "1px 7px", borderRadius: 9, background: "#ede9fe", color: "#4f46e5", fontSize: 9, fontWeight: 700 }}>you</span>}
                      {hasProfile && <span style={{ padding: "1px 7px", borderRadius: 9, background: "#f1f5f9", color: "#64748b", fontSize: 9, fontWeight: 700 }}>profile</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emailStr}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>granted {timeAgo(a.created_at)}</span>
                  <span style={{ color: "#d1d5db", fontSize: 14 }}>›</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Grant access */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Grant platform access</span>
        </div>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && invite()}
              suppressHydrationWarning
              style={{ ...inputStyle, flex: 2, minWidth: 180 }}
            />
            <input
              type="text"
              placeholder="Display name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && invite()}
              style={{ ...inputStyle, flex: 1, minWidth: 140 }}
            />
            <button
              onClick={invite}
              disabled={!email.trim() || isPending}
              style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !email.trim() || isPending ? .5 : 1, whiteSpace: "nowrap" }}
            >
              {isPending ? "Sending…" : "Invite & Grant"}
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
            New users receive an invitation email to set their password. Existing users get access immediately. You can fill in their full profile after adding them.
          </p>
          {error && <div style={{ marginTop: 10, padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>{error}</div>}
          {success && <div style={{ marginTop: 10, padding: "9px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 12, color: "#059669" }}>{success}</div>}
        </div>
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
