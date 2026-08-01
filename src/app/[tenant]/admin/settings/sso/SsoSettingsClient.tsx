"use client";

import { useState, useTransition } from "react";
import type { SsoConfig, SsoProvider } from "@/lib/repositories/ssoConfig";
import { saveSsoConfigAction, saveSamlProviderAction, deleteSamlProviderAction } from "./actions";
import { generateScimTokenAction, revokeScimTokenAction } from "./scimActions";
import PageHeader from "@/components/patterns/PageHeader";
import TogglesList from "@/components/patterns/admin/TogglesList";
import FormGrid, { type FormField } from "@/components/patterns/admin/FormGrid";
import Note from "@/components/patterns/admin/Note";

const PROVIDER_OPTIONS: { value: SsoProvider; label: string; icon: string; color: string }[] = [
  { value: "google", label: "Google Workspace", icon: "G", color: "border-[#ddd8c9] text-[#4a473e]" },
  { value: "microsoft", label: "Microsoft / Entra ID", icon: "M", color: "border-[#ddd8c9] text-[#4a473e]" },
  { value: "both", label: "Both providers", icon: "G+M", color: "border-[#ddd8c9] text-[#4a473e]" },
  { value: "saml", label: "SAML 2.0 (Okta, OneLogin, PingIdentity…)", icon: "🔒", color: "border-[#ddd8c9] text-[#4a473e]" },
];

const inputCls = "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] placeholder-[#a19d90] focus:outline-none focus:border-[#b7452f] font-mono";

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

  const fields: FormField[] = [
    {
      key: "domain",
      label: "Domain",
      input: <input value={domain} onChange={(e) => setDomain(e.target.value.replace(/^@/, ""))} placeholder="acme.com" className={inputCls} />,
    },
    {
      key: "metadataUrl",
      label: "Metadata URL",
      input: <input value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} placeholder="https://idp.example.com/metadata" className={inputCls} />,
    },
    {
      key: "metadataXml",
      label: "Metadata XML (paste directly)",
      input: <textarea value={metadataXml} onChange={(e) => setMetadataXml(e.target.value)} rows={4} placeholder="<EntityDescriptor …>" className={`${inputCls} resize-none`} />,
    },
    {
      key: "acs",
      label: "ACS URL — copy this into your IdP",
      input: (
        <code className="block w-full break-all rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-[7px] text-[11px] text-[#726e60]">
          {process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/sso/saml/acs
        </code>
      ),
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[12.5px] font-bold text-[#20201d]">SAML provider</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${connected ? "bg-[#e6efe6] text-[#4b7a4f]" : "bg-[#f1efe9] text-[#a19d90]"}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <FormGrid
        fields={fields}
        onSubmit={save}
        onCancel={connected ? remove : undefined}
        submitLabel={saving ? "Saving…" : connected ? "Update provider" : "Connect provider"}
      />
      {connected && (
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="text-[11.5px] font-semibold text-[#c0392b] hover:underline disabled:opacity-50"
        >
          {removing ? "Removing…" : "Remove SAML provider"}
        </button>
      )}
      {error && <Note icon="⚠" tone="error">{error}</Note>}
      {saved && <Note icon="✓" tone="info">Saved.</Note>}
    </div>
  );
}

function ScimSection({ slug, initial }: { slug: string; initial: { configured: boolean; lastUsedAt: string | null } }) {
  const [token, setToken] = useState<string | null>(null);
  const [configured, setConfigured] = useState(initial.configured);
  const [generating, startGenerate] = useTransition();
  const [revoking, startRevoke] = useTransition();
  const [copied, setCopied] = useState(false);

  const baseUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/scim/v2`;

  function generate() {
    startGenerate(async () => {
      const raw = await generateScimTokenAction(slug);
      setToken(raw);
      setConfigured(true);
    });
  }

  function revoke() {
    if (!confirm("Revoke the SCIM token? Your IdP will stop being able to provision or deprovision users until you generate a new one.")) return;
    startRevoke(async () => {
      await revokeScimTokenAction(slug);
      setConfigured(false);
      setToken(null);
    });
  }

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fields: FormField[] = [
    {
      key: "base",
      label: "SCIM base URL",
      input: <code className="block w-full break-all rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-[7px] text-[11px] text-[#726e60]">{baseUrl}</code>,
    },
    {
      key: "token",
      label: "Bearer token",
      input: token ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-[5px] border border-[#f0dcb8] bg-[#fdf1de] px-2.5 py-[7px] text-[11px] text-[#5e2c1f]">{token}</code>
          <button type="button" onClick={copyToken} className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-2.5 py-[7px] text-[11px] font-semibold text-[#4a473e] hover:bg-[#ede9db]">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <span className="block rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[11.5px] text-[#a19d90]">Generate to reveal</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      input: (
        <span className={`inline-block rounded-full px-2 py-[3px] text-[11px] font-semibold ${configured ? "bg-[#e6efe6] text-[#4b7a4f]" : "bg-[#f1efe9] text-[#a19d90]"}`}>
          {configured ? "Configured" : "Not configured"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-2.5">
      <h3 className="text-[12.5px] font-bold text-[#20201d]">SCIM provisioning</h3>
      <FormGrid
        fields={fields}
        onSubmit={generate}
        onCancel={configured ? revoke : undefined}
        submitLabel={generating ? "Generating…" : configured ? "Regenerate token" : "Generate token"}
      />
      {configured && (
        <button
          type="button"
          onClick={revoke}
          disabled={revoking}
          className="text-[11.5px] font-semibold text-[#c0392b] hover:underline disabled:opacity-50"
        >
          {revoking ? "Revoking…" : "Revoke token"}
        </button>
      )}
      {initial.lastUsedAt && !token && (
        <p className="text-[11px] text-[#a19d90]">Last used: {new Date(initial.lastUsedAt).toLocaleString()}</p>
      )}
    </div>
  );
}

export default function SsoSettingsClient({ slug, initial, scimStatus }: { slug: string; initial: SsoConfig | null; scimStatus: { configured: boolean; lastUsedAt: string | null } }) {
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

  function handleToggle(key: string, next: boolean) {
    if (key === "enable-sso") setEnabled(next);
    if (key === "require-sso") setSsoRequired(next);
    if (key === "auto-provision") setAutoProvision(next);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Single Sign-On (SSO)" subtitle="SAML and SCIM provisioning" />

      <div className="space-y-5 px-6">
        <TogglesList
          items={[
            { key: "enable-sso", label: "Enable SSO", description: "Let members sign in through your identity provider", on: enabled },
            {
              key: "require-sso",
              label: "Require SSO for everyone",
              description: "Disable password sign-in for all members",
              on: ssoRequired,
              tag: <span className="rounded-full bg-[#fdf1de] px-2 py-0.5 text-[10.5px] font-semibold text-[#c9791d]">Recommended</span>,
            },
            { key: "auto-provision", label: "Auto-provision new users", description: "Create a member record on first successful sign-in", on: autoProvision },
          ]}
          onChange={handleToggle}
        />

        {enabled && (
          <>
            <div className="space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Identity provider</p>
              <div className="fw-card divide-y divide-[#e3ded0]">
                {PROVIDER_OPTIONS.map((opt) => (
                  <label key={opt.value} className={`flex cursor-pointer items-center gap-3 px-3.5 py-[11px] ${provider === opt.value ? "bg-[#f4f2eb]" : ""}`}>
                    <input type="radio" name="provider" value={opt.value} checked={provider === opt.value} onChange={() => setProvider(opt.value)} className="accent-[#8c4632]" />
                    <span className={`flex h-7 w-7 items-center justify-center rounded-[5px] border text-[10px] font-bold ${opt.color}`}>{opt.icon}</span>
                    <span className="text-[12.5px] font-semibold text-[#20201d]">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {provider !== "saml" && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Domain restriction</p>
                <FormGrid
                  fields={[
                    {
                      key: "allowed-domain",
                      label: "Allowed domain",
                      input: (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-[#a19d90]">@</span>
                          <input value={domain} onChange={(e) => setDomain(e.target.value.replace(/^@/, ""))} placeholder="acme.com" className="w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] placeholder-[#a19d90] focus:outline-none focus:border-[#b7452f]" />
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {provider !== "saml" && (
              <Note icon="📋" tone="info">
                Configure the provider in Supabase → Authentication → Providers, then set the redirect URI to your Supabase auth callback. See the SAML section for a full checklist if you switch providers.
              </Note>
            )}

            {provider === "saml" && <SamlConfigPanel slug={slug} initial={initial} />}
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
          >
            {isPending ? "Saving…" : "Save SSO config"}
          </button>
          {saved && <span className="text-[11.5px] font-semibold text-[#4b7a4f]">✓ Saved</span>}
          {error && <span className="text-[11.5px] font-semibold text-[#c0392b]">{error}</span>}
        </div>

        <ScimSection slug={slug} initial={scimStatus} />
      </div>
    </div>
  );
}
