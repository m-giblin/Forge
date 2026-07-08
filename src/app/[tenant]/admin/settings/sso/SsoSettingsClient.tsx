"use client";

import { useState, useTransition } from "react";
import type { SsoConfig, SsoProvider } from "@/lib/repositories/ssoConfig";
import { saveSsoConfigAction, saveSamlProviderAction, deleteSamlProviderAction } from "./actions";

const PROVIDER_OPTIONS: { value: SsoProvider; label: string; icon: string; color: string }[] = [
  { value: "google", label: "Google Workspace", icon: "G", color: "bg-red-50 text-red-600 border-red-200" },
  { value: "microsoft", label: "Microsoft / Entra ID", icon: "M", color: "bg-blue-50 text-blue-600 border-blue-200" },
  { value: "both", label: "Both providers", icon: "G+M", color: "bg-purple-50 text-purple-600 border-purple-200" },
  { value: "saml", label: "SAML 2.0 (Okta, OneLogin, PingIdentity…)", icon: "🔒", color: "bg-amber-50 text-amber-600 border-amber-200" },
];

function SamlConfigPanel({ slug, initial }: { slug: string; initial: SsoConfig | null }) {
  const [domain, setDomain] = useState(initial?.sso_domain ?? "");
  const [metadataUrl, setMetadataUrl] = useState(initial?.saml_metadata_url ?? "");
  const [metadataXml, setMetadataXml] = useState(initial?.saml_metadata_xml ?? "");
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const connected = !!initial?.supabase_sso_provider_id;

  function save() {
    setError(null);
    setSaved(false);
    startSave(async () => {
      const result = await saveSamlProviderAction(slug, {
        domain,
        metadataUrl: metadataUrl.trim() || null,
        metadataXml: metadataXml.trim() || null,
      });
      if (!result.ok) { setError(result.error); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function remove() {
    if (!confirm("Remove this SAML provider? Users on this domain will lose SSO access.")) return;
    startRemove(async () => {
      await deleteSamlProviderAction(slug);
    });
  }

  const field = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 font-mono";
  const label = "block text-xs font-medium text-neutral-600 mb-1.5";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-800">SAML 2.0 identity provider</p>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-neutral-500">
          Get a SAML metadata URL or XML file from your identity provider (Okta, OneLogin, PingIdentity, Azure AD SAML app, etc.),
          then paste it below. Set your IdP&apos;s ACS URL to
          {" "}<code className="bg-neutral-100 text-neutral-700 rounded px-1 text-xs break-all">{process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/sso/saml/acs</code>.
        </p>
        <div>
          <label className={label}>Domain</label>
          <input value={domain} onChange={(e) => setDomain(e.target.value.replace(/^@/, ""))} placeholder="acme.com" className={field} />
        </div>
        <div>
          <label className={label}>Metadata URL <span className="text-neutral-400 font-normal">(preferred — most IdPs publish one)</span></label>
          <input value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} placeholder="https://idp.example.com/metadata" className={field} />
        </div>
        <div>
          <label className={label}>— or paste metadata XML directly —</label>
          <textarea value={metadataXml} onChange={(e) => setMetadataXml(e.target.value)} rows={4} placeholder="<EntityDescriptor …>" className={`${field} resize-none`} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving || !domain.trim()}
            className="px-4 py-2 text-sm font-medium bg-neutral-900 hover:bg-neutral-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? "Saving…" : connected ? "Update provider" : "Connect provider"}
          </button>
          {connected && (
            <button
              onClick={remove}
              disabled={removing}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
          {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-40 ${checked ? "bg-indigo-600" : "bg-neutral-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-neutral-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Card({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {(title || description) && (
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
          {title && <p className="text-sm font-semibold text-neutral-800">{title}</p>}
          {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="px-5">{children}</div>
    </div>
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
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Single Sign-On (SSO)</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Let your team sign in with their Google or Microsoft work accounts. No passwords needed.
        </p>
      </div>

      {/* Master enable */}
      <Card>
        <SettingRow
          label="Enable SSO"
          description="Shows SSO sign-in buttons on your workspace login page."
        >
          <Toggle checked={enabled} onChange={setEnabled} />
        </SettingRow>
      </Card>

      {enabled && (
        <>
          {/* Provider */}
          <Card title="Identity provider" description="Choose which identity provider(s) your team will use.">
            <div className="py-4 space-y-2">
              {PROVIDER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    provider === opt.value ? "border-indigo-300 bg-indigo-50" : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={opt.value}
                    checked={provider === opt.value}
                    onChange={() => setProvider(opt.value)}
                    className="accent-indigo-600"
                  />
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-bold ${opt.color}`}>
                    {opt.icon}
                  </span>
                  <span className="text-sm font-medium text-neutral-800">{opt.label}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* Domain restriction — OAuth (Google/Microsoft) only; SAML has its own domain field below */}
          {provider !== "saml" && (
          <Card title="Domain restriction" description="Only allow users from a specific email domain. Leave blank to allow any account.">
            <div className="py-4 space-y-0">
              <div className="pb-4 border-b border-neutral-100">
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Allowed domain</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-400 font-medium">@</span>
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.replace(/^@/, ""))}
                    placeholder="acme.com"
                    className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  />
                </div>
              </div>
              <SettingRow
                label="Auto-provision new members"
                description="Automatically add first-time SSO users to this workspace as members."
              >
                <Toggle checked={autoProvision} onChange={setAutoProvision} />
              </SettingRow>
              <SettingRow
                label="Require SSO for this domain"
                description="Block password login for emails matching the domain above — SSO only."
              >
                <Toggle checked={ssoRequired} onChange={setSsoRequired} disabled={!domain.trim()} />
              </SettingRow>
            </div>
          </Card>
          )}

          {/* Setup instructions — OAuth only */}
          {provider !== "saml" && (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center gap-2">
              <span className="text-sm">📋</span>
              <p className="text-sm font-semibold text-neutral-800">Setup checklist</p>
            </div>
            <div className="px-5 py-4 space-y-4 text-sm">
              {(provider === "google" || provider === "both") && (
                <div className="space-y-2">
                  <p className="font-semibold text-neutral-800">Google Workspace</p>
                  <ol className="space-y-1.5 text-neutral-600 list-decimal list-inside">
                    <li>Go to <code className="bg-neutral-100 text-neutral-700 rounded px-1 text-xs">Supabase → Authentication → Providers → Google</code> and enable it.</li>
                    <li>Create an OAuth 2.0 client in <code className="bg-neutral-100 text-neutral-700 rounded px-1 text-xs">console.cloud.google.com</code> → APIs &amp; Services → Credentials.</li>
                    <li>Set the authorised redirect URI to: <code className="bg-neutral-100 text-neutral-700 rounded px-1 text-xs break-all">https://leivufxfbunqawahpsss.supabase.co/auth/v1/callback</code></li>
                    <li>Paste the Client ID + Secret into Supabase → Google provider settings.</li>
                  </ol>
                </div>
              )}
              {(provider === "microsoft" || provider === "both") && (
                <div className="space-y-2 pt-3 border-t border-neutral-100">
                  <p className="font-semibold text-neutral-800">Microsoft / Entra ID</p>
                  <ol className="space-y-1.5 text-neutral-600 list-decimal list-inside">
                    <li>Go to <code className="bg-neutral-100 text-neutral-700 rounded px-1 text-xs">Supabase → Authentication → Providers → Azure</code> and enable it.</li>
                    <li>Register an app in <code className="bg-neutral-100 text-neutral-700 rounded px-1 text-xs">portal.azure.com</code> → Entra ID → App registrations.</li>
                    <li>Set the redirect URI to: <code className="bg-neutral-100 text-neutral-700 rounded px-1 text-xs break-all">https://leivufxfbunqawahpsss.supabase.co/auth/v1/callback</code></li>
                    <li>Paste the Application ID + Client Secret into Supabase → Azure provider settings.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Real SAML 2.0 connection — registers a live provider with Supabase */}
          {provider === "saml" && <SamlConfigPanel slug={slug} initial={initial} />}
        </>
      )}

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={isPending}
          className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {isPending ? "Saving…" : "Save SSO settings"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
