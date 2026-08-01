"use client";

import { useState, useTransition } from "react";
import { saveAiKeyAction, selectAiProviderAction, deleteAiKeyAction, resetToDefaultAction } from "./actions";
import { AI_PROVIDERS, type AIProvider, type SavedKeyInfo } from "@/lib/ai/providers";
import FormGrid from "@/components/patterns/admin/FormGrid";
import AdminList from "@/components/patterns/admin/AdminList";

interface Props {
  slug: string;
  savedKeys: SavedKeyInfo[];
  isAdmin: boolean;
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  xai: "xAI (Grok)",
  openai: "OpenAI (GPT-4o)",
  anthropic: "Anthropic (Claude Sonnet)",
  gemini: "Google (Gemini Flash)",
};

const fieldClass =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] outline-none focus:border-[#b7452f]";

export default function AIProviderSettings({ slug, savedKeys, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [addProvider, setAddProvider] = useState<AIProvider>("xai");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const selectedKey = savedKeys.find((k) => k.isSelected);
  const currentLabel = selectedKey
    ? `BYO · ${PROVIDER_LABELS[selectedKey.provider]}`
    : "Platform Default (Grok)";

  function flash(msg: string) {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 3000);
  }

  function handleSaveKey() {
    if (!apiKey.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveAiKeyAction(slug, addProvider, apiKey.trim());
        setApiKey("");
        flash(`${PROVIDER_LABELS[addProvider]} key saved and activated.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save key.");
      }
    });
  }

  function handleSelect(provider: AIProvider) {
    setError(null);
    startTransition(async () => {
      try {
        await selectAiProviderAction(slug, provider);
        flash(`Switched to ${PROVIDER_LABELS[provider]}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to switch provider.");
      }
    });
  }

  function handleDelete(provider: AIProvider) {
    if (!confirm(`Delete the ${PROVIDER_LABELS[provider]} key? The sounding board will fall back to the platform default.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteAiKeyAction(slug, provider);
        flash(`${PROVIDER_LABELS[provider]} key deleted.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete key.");
      }
    });
  }

  function handleReset() {
    if (!confirm("Reset to Platform Default (Grok)? Your saved keys are kept but deactivated.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await resetToDefaultAction(slug);
        flash("Reset to Platform Default.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reset.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Current status */}
      <div className="fw-card px-4 py-3.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Active AI Provider</p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span className="text-[15px] font-bold font-[family-name:var(--font-manrope)] text-[#20201d]">{currentLabel}</span>
          {selectedKey ? (
            <span className="rounded-full border border-[#c9d9c9] bg-[#eaf3ea] px-2 py-0.5 text-[10.5px] font-semibold text-[#4b7a4f]">
              BYO Active
            </span>
          ) : (
            <span className="rounded-full border border-[#ddd8c9] bg-[#f4f2eb] px-2 py-0.5 text-[10.5px] font-semibold text-[#726e60]">
              Platform Default
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-[#726e60]">
          {selectedKey
            ? "The sounding board uses your BYO key. Your API usage and costs are billed to your key."
            : "The sounding board uses Forge's shared Grok key. Subject to platform rate limits."}
        </p>
        {selectedKey && isAdmin && (
          <button
            onClick={handleReset}
            disabled={isPending}
            className="mt-2.5 text-[11px] font-semibold text-[#b7452f] hover:underline disabled:opacity-50"
          >
            Reset to Platform Default
          </button>
        )}
      </div>

      {/* Feedback */}
      {success && (
        <p className="text-[12px] font-semibold text-[#4b7a4f]">{success}</p>
      )}
      {error && (
        <p className="text-[12px] font-semibold text-[#c0392b]">{error}</p>
      )}

      {/* Saved keys */}
      {savedKeys.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12.5px] font-bold text-[#20201d]">Saved BYO Keys</h3>
          <AdminList
            items={savedKeys.map((k) => ({
              key: k.provider,
              title: PROVIDER_LABELS[k.provider],
              subline: k.keyHint || undefined,
              badge: k.isSelected ? (
                <span className="rounded-full border border-[#c9d9c9] bg-[#eaf3ea] px-2 py-0.5 text-[10.5px] font-semibold text-[#4b7a4f]">Active</span>
              ) : undefined,
              actionLabel: isAdmin && !k.isSelected ? "Use this" : undefined,
              onAction: isAdmin && !k.isSelected ? () => handleSelect(k.provider) : undefined,
            }))}
          />
          {isAdmin && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {savedKeys.map((k) => (
                <button
                  key={k.provider}
                  onClick={() => handleDelete(k.provider)}
                  disabled={isPending}
                  className="text-[11px] font-semibold text-[#a19d90] hover:text-[#c0392b] disabled:opacity-50"
                >
                  Delete {PROVIDER_LABELS[k.provider]} key
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / update key */}
      {isAdmin && (
        <div>
          <h3 className="mb-2 text-[12.5px] font-bold text-[#20201d]">
            {savedKeys.length > 0 ? "Add or Update a Key" : "Connect a BYO Key"}
          </h3>
          <FormGrid
            submitLabel={isPending ? "Saving…" : "Save & activate key"}
            onSubmit={apiKey.trim() ? handleSaveKey : undefined}
            fields={[
              {
                key: "provider",
                label: "Model provider",
                input: (
                  <select
                    value={addProvider}
                    onChange={(e) => setAddProvider(e.target.value as AIProvider)}
                    className={fieldClass}
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "apiKey",
                label: "API key",
                wide: true,
                input: (
                  <div className="flex gap-2">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your API key…"
                      autoComplete="off"
                      className={`${fieldClass} flex-1 font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-[7px] text-[11px] font-semibold text-[#4a473e] hover:bg-[#ede9db]"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                ),
              },
            ]}
          />
          <p className="mt-1.5 text-[10.5px] text-[#a19d90]">
            Keys are encrypted with AES-256-GCM and never logged or returned via API.
          </p>
        </div>
      )}
    </div>
  );
}
