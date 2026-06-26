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

// ── Profile slide-over ───────────────────────────────────────────────────────
function ProfilePanel({
  admin,
  isMe,
  onClose,
  onSave,
  onRevoke,
}: {
  admin: SuperAdminRow;
  isMe: boolean;
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
    setSaving(true);
    setError(null);
    setSaved(false);
    const err = await onSave(admin.user_id, form);
    setSaving(false);
    if (err) { setError(err); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const email = admin.user?.email ?? "—";

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" />
      {/* Panel */}
      <div
        className="w-full max-w-md bg-neutral-900 border-l border-neutral-700 flex flex-col h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials(admin)}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{displayLabel(admin)}</h2>
              <p className="text-xs text-neutral-400">{email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition text-xl leading-none px-1">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-6 space-y-5">
          {/* Access info */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-800/50 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Platform access granted</p>
              <p className="text-sm font-medium text-white mt-0.5">{timeAgo(admin.created_at)}</p>
            </div>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300">
              Super Admin
            </span>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <Field label="Display Name" value={form.display_name} onChange={field("display_name")} placeholder="e.g. Matt Giblin" />
            <Field label="Primary Email" value={email} disabled placeholder="" />
            <Field label="Alternative Email" value={form.alt_email} onChange={field("alt_email")} placeholder="backup@example.com" type="email" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone (office)" value={form.phone} onChange={field("phone")} placeholder="+1 (555) 000-0000" type="tel" />
              <Field label="Cell / Mobile" value={form.cell} onChange={field("cell")} placeholder="+1 (555) 000-0000" type="tel" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={field("notes")}
                placeholder="e.g. Primary on-call contact, backup for compliance reviews…"
                rows={3}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>
          )}
          {saved && (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
              Profile saved.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between gap-3">
          {!isMe ? (
            <button
              onClick={() => onRevoke(admin.user_id, email)}
              className="text-sm text-red-400 hover:text-red-300 transition font-medium"
            >
              Revoke access
            </button>
          ) : (
            <span className="text-xs text-neutral-600">You cannot revoke your own access</span>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium text-white transition"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", disabled = false,
}: {
  label: string; value: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminsClient({
  initialAdmins,
  currentUserId,
}: {
  initialAdmins: SuperAdminRow[];
  currentUserId: string;
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
    setError(null);
    setSuccess(null);
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
      setEmail("");
      setName("");
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
    // Update local state
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

  return (
    <div className="space-y-6">
      {/* Admin list */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Current platform admins</h2>
          <span className="text-xs text-neutral-500">{admins.length} account{admins.length !== 1 ? "s" : ""}</span>
        </div>

        {admins.length === 0 ? (
          <p className="px-5 py-8 text-sm text-neutral-500 text-center">No admins found.</p>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {admins.map((a) => {
              const isMe = a.user_id === currentUserId;
              const label = displayLabel(a);
              const emailStr = a.user?.email ?? "—";
              const hasProfile = a.phone || a.cell || a.alt_email || a.notes;
              return (
                <li
                  key={a.user_id}
                  onClick={() => setSelected(a)}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-neutral-800/60 transition group"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {initials(a)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-100 truncate">{label}</span>
                      {isMe && (
                        <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">you</span>
                      )}
                      {hasProfile && (
                        <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400">profile</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{emailStr}</p>
                  </div>
                  <span className="text-xs text-neutral-500 shrink-0 hidden sm:block">granted {timeAgo(a.created_at)}</span>
                  <span className="text-neutral-600 group-hover:text-neutral-400 transition text-sm">›</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Invite form */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-sm font-semibold text-neutral-200 mb-4">Grant platform access</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email && invite()}
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email && invite()}
            className="w-full sm:w-48 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-indigo-500"
          />
          <button
            onClick={invite}
            disabled={!email.trim() || isPending}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium text-white transition shrink-0"
          >
            {isPending ? "Sending…" : "Invite & Grant"}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          New users receive an invitation email to set their password. Existing users get access immediately.
          You can fill in their full profile after adding them.
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {success && (
          <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">{success}</div>
        )}
      </div>

      {/* Profile slide-over */}
      {selected && (
        <ProfilePanel
          admin={selected}
          isMe={selected.user_id === currentUserId}
          onClose={() => setSelected(null)}
          onSave={saveProfile}
          onRevoke={async (userId, userEmail) => {
            await revoke(userId, userEmail);
          }}
        />
      )}
    </div>
  );
}
