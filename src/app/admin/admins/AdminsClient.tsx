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

export default function AdminsClient({
  initialAdmins,
  currentUserId,
}: {
  initialAdmins: SuperAdminRow[];
  currentUserId: string;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);

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

      // Refresh list
      const listRes = await fetch("/api/admin/super-admins");
      const listJson = await listRes.json();
      setAdmins(listJson.data ?? []);
      setSuccess(`Invitation sent to ${email.trim()}. They'll receive an email to set their password.`);
      setEmail("");
      setName("");
    });
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
    setRevoking(null);
  }

  return (
    <div className="space-y-6">
      {/* Current admins */}
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
              const displayEmail = a.user?.email ?? "—";
              const displayName = a.user?.name;
              return (
                <li key={a.user_id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {(displayName ?? displayEmail).charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-100 truncate">
                        {displayName ?? displayEmail}
                      </span>
                      {isMe && (
                        <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                          you
                        </span>
                      )}
                    </div>
                    {displayName && (
                      <p className="text-xs text-neutral-500 truncate">{displayEmail}</p>
                    )}
                  </div>

                  {/* Granted date */}
                  <span className="text-xs text-neutral-500 shrink-0">granted {timeAgo(a.created_at)}</span>

                  {/* Revoke */}
                  {isMe ? (
                    <span className="text-xs text-neutral-600 w-16 text-right">—</span>
                  ) : (
                    <button
                      onClick={() => revoke(a.user_id, displayEmail)}
                      disabled={revoking === a.user_id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition font-medium w-16 text-right"
                    >
                      {revoking === a.user_id ? "Revoking…" : "Revoke"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add new admin */}
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
          If the email is new to Forge, they'll receive an invitation to set their password. Existing users get access immediately.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
