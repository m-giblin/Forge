"use client";

import { useState, useTransition } from "react";
import type { ChatProvider } from "@/lib/services/chatNotifications";
import { saveChatWebhookAction } from "./actions";

const PROVIDERS: { key: ChatProvider; label: string; icon: string; hint: string }[] = [
  {
    key: "slack",
    label: "Slack",
    icon: "💬",
    hint: "Create an Incoming Webhook at api.slack.com/apps → Incoming Webhooks",
  },
  {
    key: "teams",
    label: "Microsoft Teams",
    icon: "🟦",
    hint: "In Teams: channel → Connectors → Incoming Webhook → paste URL here",
  },
  {
    key: "discord",
    label: "Discord",
    icon: "🎮",
    hint: "In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy URL",
  },
];

export default function ChatSettingsClient({
  slug,
  webhooks,
}: {
  slug: string;
  webhooks: Record<ChatProvider, string>;
}) {
  const [values, setValues] = useState<Record<ChatProvider, string>>(webhooks);
  const [saved, setSaved] = useState<ChatProvider | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function save(provider: ChatProvider) {
    setErrors((e) => ({ ...e, [provider]: "" }));
    startTransition(async () => {
      try {
        await saveChatWebhookAction(slug, provider, values[provider].trim());
        setSaved(provider);
        setTimeout(() => setSaved(null), 2000);
      } catch (e) {
        setErrors((prev) => ({ ...prev, [provider]: String(e) }));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Chat Notifications</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Post issue alerts to Slack, Teams, or Discord when issues are created or commented on
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map(({ key, label, icon, hint }) => (
          <div key={key} className="border border-zinc-700 rounded-lg p-5 bg-zinc-800/40 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">{label}</h3>
                {values[key] && (
                  <span className="h-2 w-2 rounded-full bg-green-400" title="Connected" />
                )}
              </div>
            </div>

            <p className="text-xs text-zinc-500">{hint}</p>

            {errors[key] && <p className="text-xs text-red-400">{errors[key]}</p>}

            <div className="flex gap-2">
              <input
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white placeholder-zinc-600 font-mono"
              />
              <button
                onClick={() => save(key)}
                disabled={isPending}
                className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md whitespace-nowrap"
              >
                {saved === key ? "✓ Saved" : values[key] ? "Save" : "Clear"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-zinc-800 rounded-lg p-4 text-xs text-zinc-500 space-y-1">
        <p className="font-semibold text-zinc-400">When notifications fire</p>
        <p>• Issue created in any project</p>
        <p>• Comment posted on any issue</p>
        <p>• Leave a URL blank to disable that provider</p>
      </div>
    </div>
  );
}
