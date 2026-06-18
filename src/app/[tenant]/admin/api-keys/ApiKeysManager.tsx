"use client";

import { useState, useTransition } from "react";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";
import { SCOPES } from "@/lib/api/scopes";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
};

const SCOPE_OPTIONS = [
  { value: SCOPES.ISSUES_READ, label: "Read issues" },
  { value: SCOPES.ISSUES_WRITE, label: "Create / update issues" },
];

const EXPIRY_OPTIONS = [
  { label: "No expiry", days: null },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

function expiresAtFromDays(days: number | null): string | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function keyStatus(k: ApiKeyRow, nowMs: number): "revoked" | "expired" | "expiring" | "active" {
  if (k.revoked_at) return "revoked";
  if (k.expires_at && new Date(k.expires_at).getTime() < nowMs) return "expired";
  if (k.expires_at) {
    const daysLeft = (new Date(k.expires_at).getTime() - nowMs) / 86_400_000;
    if (daysLeft <= 30) return "expiring";
  }
  return "active";
}

function StatusBadge({ k, nowMs }: { k: ApiKeyRow; nowMs: number }) {
  const status = keyStatus(k, nowMs);
  if (status === "revoked")
    return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">revoked</span>;
  if (status === "expired")
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">expired</span>;
  if (status === "expiring") {
    const daysLeft = Math.ceil((new Date(k.expires_at!).getTime() - nowMs) / 86_400_000);
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
        expires in {daysLeft}d
      </span>
    );
  }
  return <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">active</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ApiKeysManager({
  slug,
  initialKeys,
  readOnly = false,
}: {
  slug: string;
  initialKeys: ApiKeyRow[];
  readOnly?: boolean;
}) {
  const [nowMs] = useState(() => Date.now());
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([SCOPES.ISSUES_READ, SCOPES.ISSUES_WRITE]);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleScope(s: string) {
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  function create() {
    if (!name.trim() || scopes.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const expiresAt = expiresAtFromDays(expiryDays);
        const { raw } = await createApiKeyAction(slug, { name: name.trim(), scopes, expiresAt });
        setRevealed(raw);
        setCopied(false);
        setName("");
        setKeys((cur) => [
          {
            id: raw,
            name: name.trim(),
            key_prefix: raw.slice(0, 20),
            scopes,
            last_used_at: null,
            revoked_at: null,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
          },
          ...cur,
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create key");
      }
    });
  }

  function revoke(id: string) {
    if (!confirm("Revoke this key? Any app using it will immediately lose access.")) return;
    startTransition(async () => {
      try {
        await revokeApiKeyAction(slug, id);
        setKeys((cur) => cur.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to revoke");
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {/* one-time reveal */}
      {revealed && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Copy your new key now — it won&rsquo;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-neutral-800">
              {revealed}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(revealed); setCopied(true); }}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setRevealed(null)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-600 hover:bg-neutral-100"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* create form */}
      {!readOnly && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-neutral-600">Key name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Travli production"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-neutral-600">Permissions</span>
              <div className="flex gap-3">
                {SCOPE_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5 text-sm text-neutral-700">
                    <input type="checkbox" checked={scopes.includes(o.value)} onChange={() => toggleScope(o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Expires</label>
              <select
                value={expiryDays ?? ""}
                onChange={(e) => setExpiryDays(e.target.value === "" ? null : Number(e.target.value))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={String(o.days)} value={o.days ?? ""}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={create}
              disabled={pending || !name.trim() || scopes.length === 0}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create key"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* list */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Key</th>
              <th className="px-4 py-2.5 font-medium">Scopes</th>
              <th className="px-4 py-2.5 font-medium">Expires</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const status = keyStatus(k, nowMs);
              const isActionable = status === "active" || status === "expiring";
              return (
                <tr key={k.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-800">{k.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-400">{k.key_prefix}…</td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">{k.scopes.join(", ")}</td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">
                    {k.expires_at ? formatDate(k.expires_at) : <span className="text-neutral-300">Never</span>}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge k={k} nowMs={nowMs} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {isActionable && !readOnly && (
                      <button onClick={() => revoke(k.id)} className="text-xs font-medium text-red-600 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-400">
                  No API keys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
