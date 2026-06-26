"use client";

import { useState, useTransition } from "react";
import type { ChatProvider } from "@/lib/services/chatNotifications";
import { saveChatWebhookAction, saveSlackBotAction } from "./actions";

const PROVIDERS: { key: ChatProvider; label: string; icon: string; hint: string; docsUrl: string }[] = [
  {
    key: "slack",
    label: "Slack",
    icon: "💬",
    hint: "Create an Incoming Webhook at api.slack.com/apps → Incoming Webhooks",
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
  {
    key: "teams",
    label: "Microsoft Teams",
    icon: "🟦",
    hint: "In Teams: channel → Connectors → Incoming Webhook → paste URL here",
    docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
  },
  {
    key: "discord",
    label: "Discord",
    icon: "🎮",
    hint: "In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy URL",
    docsUrl: "https://support.discord.com/hc/en-us/articles/228383668",
  },
];

export default function ChatSettingsClient({
  slug,
  webhooks,
  slackBot,
}: {
  slug: string;
  webhooks: Record<ChatProvider, string>;
  slackBot: { botToken: string; signingSecret: string; workspaceId: string };
}) {
  const [values, setValues] = useState<Record<ChatProvider, string>>(webhooks);
  const [saved, setSaved] = useState<ChatProvider | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Slack bot fields
  const [botFields, setBotFields] = useState(slackBot);
  const [botSaved, setBotSaved] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const botConfigured = !!(botFields.botToken && botFields.signingSecret && botFields.workspaceId);

  function saveBot() {
    setBotError(null);
    startTransition(async () => {
      try {
        await saveSlackBotAction(slug, botFields);
        setBotSaved(true);
        setTimeout(() => setBotSaved(false), 2000);
      } catch (e) {
        setBotError(String(e));
      }
    });
  }

  function clearBot() {
    setBotFields({ botToken: "", signingSecret: "", workspaceId: "" });
    startTransition(async () => {
      await saveSlackBotAction(slug, { botToken: "", signingSecret: "", workspaceId: "" });
    });
  }

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

  const connected = PROVIDERS.filter((p) => values[p.key]?.trim()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Chat Notifications</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Post issue alerts to Slack, Teams, or Discord when issues are created or commented on.
        </p>
        {connected > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {connected} channel{connected > 1 ? "s" : ""} connected
          </div>
        )}
      </div>

      {/* Provider cards */}
      <div className="space-y-4">
        {PROVIDERS.map(({ key, label, icon, hint }) => {
          const isConnected = !!values[key]?.trim();
          return (
            <div key={key} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{icon}</span>
                  <span className="text-sm font-semibold text-neutral-900">{label}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isConnected
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-neutral-100 text-neutral-500"
                }`}>
                  {isConnected ? "● Connected" : "Not connected"}
                </span>
              </div>

              {/* Card body */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-neutral-500">{hint}</p>

                {errors[key] && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errors[key]}</p>
                )}

                <div className="flex gap-2">
                  <input
                    value={values[key]}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..."
                    className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 font-mono focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  />
                  <button
                    onClick={() => save(key)}
                    disabled={isPending}
                    className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors disabled:opacity-50 ${
                      saved === key
                        ? "bg-green-600 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {saved === key ? "✓ Saved" : isConnected ? "Update" : "Connect"}
                  </button>
                  {isConnected && saved !== key && (
                    <button
                      onClick={() => {
                        setValues((v) => ({ ...v, [key]: "" }));
                        saveChatWebhookAction(slug, key, "").catch(() => null);
                      }}
                      className="px-3 py-2 text-sm text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slack Bot (inbound: Slack → Forge) */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🤖</span>
            <div>
              <span className="text-sm font-semibold text-neutral-900">Slack Bot</span>
              <p className="text-xs text-neutral-400 mt-0.5">Inbound — create Forge issues from Slack</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            botConfigured
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-neutral-100 text-neutral-500"
          }`}>
            {botConfigured ? "● Configured" : "Not configured"}
          </span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-neutral-500">
            Enables <code className="bg-neutral-100 px-1 rounded">/forge [title]</code> slash command and 🐛 reaction → issue creation.
            See ticket comments for full Slack app setup instructions.
          </p>
          {botError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{botError}</p>
          )}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Bot User OAuth Token <span className="text-neutral-400">(starts with xoxb-)</span></label>
              <input
                type="password"
                value={botFields.botToken}
                onChange={(e) => setBotFields((f) => ({ ...f, botToken: e.target.value }))}
                placeholder="xoxb-..."
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Signing Secret</label>
              <input
                type="password"
                value={botFields.signingSecret}
                onChange={(e) => setBotFields((f) => ({ ...f, signingSecret: e.target.value }))}
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Workspace ID <span className="text-neutral-400">(starts with T, found on Basic Information page)</span></label>
              <input
                value={botFields.workspaceId}
                onChange={(e) => setBotFields((f) => ({ ...f, workspaceId: e.target.value }))}
                placeholder="T0XXXXXXXXX"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveBot}
              disabled={isPending}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                botSaved ? "bg-green-600 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {botSaved ? "✓ Saved" : botConfigured ? "Update" : "Save"}
            </button>
            {botConfigured && (
              <button
                onClick={clearBot}
                className="px-3 py-2 text-sm text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50"
              >
                Disconnect
              </button>
            )}
          </div>
          {botConfigured && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">Endpoint URLs to configure in your Slack app:</p>
              <p>Slash command: <code className="bg-blue-100 px-1 rounded">/api/slack/slash</code></p>
              <p>Event subscriptions: <code className="bg-blue-100 px-1 rounded">/api/slack/events</code></p>
            </div>
          )}
        </div>
      </div>

      {/* When notifications fire */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-semibold text-neutral-800 mb-3">When notifications fire</p>
        <ul className="space-y-2 text-sm text-neutral-600">
          <li className="flex items-center gap-2"><span className="text-indigo-500">•</span> Issue created in any project</li>
          <li className="flex items-center gap-2"><span className="text-indigo-500">•</span> Comment posted on any issue</li>
          <li className="flex items-center gap-2"><span className="text-indigo-500">•</span> Priority changed to Urgent</li>
        </ul>
        <p className="mt-3 text-xs text-neutral-400">Leave a URL blank (or click Disconnect) to disable that provider.</p>
      </div>
    </div>
  );
}
