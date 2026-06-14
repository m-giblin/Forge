"use client";

import { useState, useTransition } from "react";
import { provisionTenantAction, setSuspendedAction, deleteTenantAction } from "./actions";
import { startImpersonationAction } from "@/app/impersonation-actions";

type TenantStat = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  plan: string;
  member_count: number;
  issue_count: number;
};

export default function AdminConsole({ tenants }: { tenants: TenantStat[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // provision form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function provision() {
    setError(null);
    startTransition(async () => {
      try {
        const { ownerInviteToken } = await provisionTenantAction({ name, slug, ownerEmail });
        setInviteLink(`${window.location.origin}/join/${ownerInviteToken}`);
        setCopied(false);
        setName(""); setSlug(""); setOwnerEmail("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to provision");
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

      {/* Provision */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-semibold text-neutral-200">Provision a workspace</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Name" value={name} onChange={setName} placeholder="Acme Inc" />
          <Field label="Slug" value={slug} onChange={setSlug} placeholder="acme" mono />
          <Field label="Owner email" value={ownerEmail} onChange={setOwnerEmail} placeholder="owner@acme.com" />
          <button
            onClick={provision}
            disabled={pending || !name || !slug || !ownerEmail}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-40"
          >
            Provision
          </button>
        </div>
        {inviteLink && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-medium text-amber-300">Send this owner invite link to the new owner:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200">{inviteLink}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); }}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-900"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tenants */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Workspace</th>
              <th className="px-4 py-2.5 font-medium">Members</th>
              <th className="px-4 py-2.5 font-medium">Issues</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-neutral-800/60 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="text-neutral-100">{t.name}</div>
                  <div className="font-mono text-xs text-neutral-500">/{t.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-neutral-300">{t.member_count}</td>
                <td className="px-4 py-2.5 text-neutral-300">{t.issue_count}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${t.status === "active" ? "bg-green-500/15 text-green-300" : "bg-neutral-700 text-neutral-300"}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => run(() => startImpersonationAction(t.id, t.slug))}
                    disabled={pending}
                    className="mr-3 text-xs font-medium text-sky-400 hover:underline"
                  >
                    View as
                  </button>
                  <button
                    onClick={() => run(() => setSuspendedAction(t.id, t.status === "active"))}
                    disabled={pending}
                    className="mr-3 text-xs font-medium text-amber-400 hover:underline"
                  >
                    {t.status === "active" ? "Suspend" : "Reactivate"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Permanently delete ${t.name} and ALL its data? This cannot be undone.`))
                        run(() => deleteTenantAction(t.id));
                    }}
                    disabled={pending}
                    className="text-xs font-medium text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, mono,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-xs font-medium text-neutral-400">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
