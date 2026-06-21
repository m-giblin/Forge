"use client";

import { useState, useTransition } from "react";
import type { SsoConfig, SsoProvider } from "@/lib/repositories/ssoConfig";
import { saveSsoConfigAction } from "./actions";

const PROVIDER_OPTIONS: { value: SsoProvider; label: string; icon: string }[] = [
  { value: "google", label: "Google Workspace", icon: "G" },
  { value: "microsoft", label: "Microsoft / Entra ID", icon: "M" },
  { value: "both", label: "Both", icon: "G+M" },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-40 ${checked ? "bg-indigo-600" : "bg-zinc-600"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function SsoSettingsClient({ slug, initial }: { slug: string; initial: SsoConfig | null }) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [provider, setProvider] = useState<SsoProvider>(initial?.provider ?? "google");
  const [domain, setDomain] = useState(initial?.allowed_domain ?? "");
  const [autoProvision, setAutoProvision] = useState(initial?.auto_provision ?? true);
  const [ssoRequired, setSsoRequired] = useState(initial?.sso_required ?? false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveSsoConfigAction(slug, { enabled, provider, allowed_domain: domain || null, auto_provision: autoProvision, sso_required: ssoRequired });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Single Sign-On (SSO)</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Let your team sign in with their Google or Microsoft work accounts. No passwords needed.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between border border-zinc-700 rounded-lg px-5 py-4 bg-zinc-800/40">
        <div>
          <p className="text-sm font-medium text-white">Enable SSO</p>
          <p className="text-xs text-zinc-400 mt-0.5">Shows SSO sign-in buttons on your workspace login page.</p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      {enabled && (
        <>
          {/* Provider selection */}
          <div className="border border-zinc-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-zinc-800/60 border-b border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-200">Identity provider</h3>
            </div>
            <div className="p-4 space-y-2">
              {PROVIDER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="provider"
                    value={opt.value}
                    checked={provider === opt.value}
                    onChange={() => setProvider(opt.value)}
                    className="accent-indigo-500"
                  />
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-md bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-white">
                      {opt.icon}
                    </span>
                    <span className="text-sm text-zinc-200">{opt.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Domain restriction */}
          <div className="border border-zinc-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-zinc-800/60 border-b border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-200">Domain restriction</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Only allow users from a specific email domain. Leave blank to allow any account.</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Allowed domain</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500">@</span>
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.replace(/^@/, ""))}
                    placeholder="acme.com"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-200">Auto-provision new members</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Automatically add first-time SSO users to this workspace as members.</p>
                </div>
                <Toggle checked={autoProvision} onChange={setAutoProvision} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-200">Require SSO for this domain</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Block password login for emails matching the domain above — SSO only.</p>
                </div>
                <Toggle checked={ssoRequired} onChange={setSsoRequired} disabled={!domain.trim()} />
              </div>
            </div>
          </div>

          {/* Setup instructions */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-3 text-xs text-zinc-500">
            <p className="font-semibold text-zinc-400">Setup checklist</p>
            {(provider === "google" || provider === "both") && (
              <div className="space-y-1">
                <p className="text-zinc-300 font-medium">Google Workspace</p>
                <p>1. Go to <span className="font-mono text-zinc-400">Supabase → Authentication → Providers → Google</span> and enable it.</p>
                <p>2. Create an OAuth 2.0 client in <span className="font-mono text-zinc-400">console.cloud.google.com</span> → APIs &amp; Services → Credentials.</p>
                <p>3. Set the authorised redirect URI to: <span className="font-mono text-zinc-400 break-all">https://leivufxfbunqawahpsss.supabase.co/auth/v1/callback</span></p>
                <p>4. Paste the Client ID + Secret into Supabase → Google provider settings.</p>
              </div>
            )}
            {(provider === "microsoft" || provider === "both") && (
              <div className="space-y-1 pt-2 border-t border-zinc-800">
                <p className="text-zinc-300 font-medium">Microsoft / Entra ID</p>
                <p>1. Go to <span className="font-mono text-zinc-400">Supabase → Authentication → Providers → Azure</span> and enable it.</p>
                <p>2. Register an app in <span className="font-mono text-zinc-400">portal.azure.com</span> → Entra ID → App registrations.</p>
                <p>3. Set the redirect URI to: <span className="font-mono text-zinc-400 break-all">https://leivufxfbunqawahpsss.supabase.co/auth/v1/callback</span></p>
                <p>4. Paste the Application ID + Client Secret into Supabase → Azure provider settings.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* SAML placeholder */}
      <div className="border border-dashed border-zinc-700 rounded-lg p-4 opacity-60">
        <div className="flex items-center gap-3">
          <span className="text-lg">🔒</span>
          <div>
            <p className="text-sm font-medium text-zinc-300">SAML 2.0 / Enterprise SSO</p>
            <p className="text-xs text-zinc-500 mt-0.5">Custom SAML integration with Okta, OneLogin, PingIdentity, and others. Available on enterprise plans — <span className="text-indigo-400">contact us</span> to enable.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isPending}
          className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md"
        >
          {isPending ? "Saving…" : "Save SSO settings"}
        </button>
        {saved && <span className="text-sm text-green-400">Saved ✓</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
