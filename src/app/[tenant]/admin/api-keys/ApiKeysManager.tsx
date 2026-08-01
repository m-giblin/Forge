"use client";

import { useState, useTransition } from "react";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";
import { SCOPES } from "@/lib/api/scopes";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable, { type AdminTableCell } from "@/components/patterns/admin/AdminTable";
import FormGrid from "@/components/patterns/admin/FormGrid";
import TogglesList from "@/components/patterns/admin/TogglesList";

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

const STATUS_CHIP: Record<ReturnType<typeof keyStatus>, { fg: string; bg: string; label: (k: ApiKeyRow, nowMs: number) => string }> = {
  active: { fg: "#2f6e35", bg: "#e6f0e3", label: () => "Active" },
  revoked: { fg: "#8a8672", bg: "#eeece3", label: () => "Revoked" },
  expired: { fg: "#a3372a", bg: "#fbeae8", label: () => "Expired" },
  expiring: {
    fg: "#8c4632",
    bg: "#f5e4dd",
    label: (k, nowMs) => `Expires in ${Math.ceil((new Date(k.expires_at!).getTime() - nowMs) / 86_400_000)}d`,
  },
};

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

  const rows: AdminTableCell[][] = keys.map((k) => {
    const status = keyStatus(k, nowMs);
    const chip = STATUS_CHIP[status];
    const isActionable = status === "active" || status === "expiring";
    return [
      { kind: "bold", value: k.name },
      { kind: "mono", value: `${k.key_prefix}…` },
      { kind: "dim", value: k.scopes.join(", ") },
      { kind: "dim", value: k.expires_at ? formatDate(k.expires_at) : "Never" },
      { kind: "chip", value: chip.label(k, nowMs), chipFg: chip.fg, chipBg: chip.bg },
      {
        kind: "link",
        value: isActionable && !readOnly ? "Revoke" : "",
        onClick: isActionable && !readOnly ? () => revoke(k.id) : undefined,
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader title="API Keys" subtitle="Programmatic access to this workspace" />

      <div className="space-y-6 px-6">
        {/* one-time reveal */}
        {revealed && (
          <div className="fw-card border-[#8c4632]/40 px-4 py-3.5">
            <p className="text-[12.5px] font-semibold text-[#8c4632]">
              Copy your new key now — it won&rsquo;t be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-[5px] bg-[#f4f2eb] px-3 py-2 text-[11px] text-[#20201d]">
                {revealed}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(revealed); setCopied(true); }}
                className="rounded-[5px] border border-[#5e2c1f] px-3 py-2 text-[11.5px] font-semibold text-[#f2e9d8]"
                style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => setRevealed(null)}
                className="rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-2 text-[11.5px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-[12px] font-medium text-[#a3372a]">{error}</p>}

        {/* create form */}
        {!readOnly && (
          <div>
            <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Create key</h2>
            <FormGrid
              submitLabel={pending ? "Creating…" : "Create key"}
              onSubmit={create}
              fields={[
                {
                  key: "name",
                  label: "Name",
                  input: (
                    <input
                      data-ember-tour="admin-api-keys-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Travli production"
                      className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]"
                    />
                  ),
                },
                {
                  key: "expires",
                  label: "Expires",
                  input: (
                    <select
                      value={expiryDays ?? ""}
                      onChange={(e) => setExpiryDays(e.target.value === "" ? null : Number(e.target.value))}
                      className="rounded-[5px] border border-[#ddd8c9] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#8c4632]"
                    >
                      {EXPIRY_OPTIONS.map((o) => (
                        <option key={String(o.days)} value={o.days ?? ""}>{o.label}</option>
                      ))}
                    </select>
                  ),
                },
                {
                  key: "scopes",
                  label: "Scopes / project scope",
                  input: (
                    <div data-ember-tour="admin-api-keys-scopes">
                      <TogglesList
                        items={SCOPE_OPTIONS.map((o) => ({ key: o.value, label: o.label, on: scopes.includes(o.value) }))}
                        onChange={(key) => toggleScope(key)}
                      />
                      <p className="mt-1.5 text-[11px] text-[#a19d90]">Keys are scoped to this workspace only.</p>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* list */}
        <div>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Keys</h2>
          <AdminTable
            minWidth={720}
            columns={[
              { label: "Name", flex: true },
              { label: "Key", width: 150 },
              { label: "Scopes", width: 170 },
              { label: "Expires", width: 110 },
              { label: "Status", width: 130 },
              { label: "", width: 70 },
            ]}
            rows={rows}
          />
          {keys.length === 0 && (
            <p className="fw-card mt-2 px-4 py-8 text-center text-[12px] text-[#a19d90]">No API keys yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
