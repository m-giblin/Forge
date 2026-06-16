"use client";

import { useState, useTransition } from "react";
import { saveAiKeyAction, selectAiProviderAction, deleteAiKeyAction, resetToDefaultAction } from "./actions";
import { AI_PROVIDERS, type AIProvider, type SavedKeyInfo } from "@/lib/ai/providers";

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
    <div className="space-y-6">
      {/* Current status */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Active AI Provider</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-lg font-semibold text-neutral-900">{currentLabel}</span>
          {selectedKey && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              BYO Active
            </span>
          )}
          {!selectedKey && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
              Platform Default
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          {selectedKey
            ? "The sounding board uses your BYO key. Your API usage and costs are billed to your key."
            : "The sounding board uses Forge's shared Grok key. Subject to platform rate limits."}
        </p>
        {selectedKey && isAdmin && (
          <button
            onClick={handleReset}
            disabled={isPending}
            className="mt-3 text-xs text-neutral-400 underline hover:text-neutral-600 disabled:opacity-50"
          >
            Reset to Platform Default
          </button>
        )}
      </div>

      {/* Feedback */}
      {success && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Saved keys */}
      {savedKeys.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-3">
            <p className="text-sm font-medium text-neutral-700">Saved BYO Keys</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {savedKeys.map((k) => (
              <div key={k.provider} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-800">{PROVIDER_LABELS[k.provider]}</p>
                  {k.keyHint && (
                    <p className="text-xs text-neutral-400 font-mono">{k.keyHint}</p>
                  )}
                </div>
                {k.isSelected ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Active
                  </span>
                ) : (
                  isAdmin && (
                    <button
                      onClick={() => handleSelect(k.provider)}
                      disabled={isPending}
                      className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Use this
                    </button>
                  )
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(k.provider)}
                    disabled={isPending}
                    className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / update key */}
      {isAdmin && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-neutral-700">
            {savedKeys.length > 0 ? "Add or Update a Key" : "Connect a BYO Key"}
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Provider</label>
              <select
                value={addProvider}
                onChange={(e) => setAddProvider(e.target.value as AIProvider)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">API Key</label>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key…"
                  autoComplete="off"
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Keys are encrypted with AES-256-GCM and never logged or returned via API.
              </p>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={isPending || !apiKey.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save & activate key"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
