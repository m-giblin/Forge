"use client";

import { useState, useTransition } from "react";
import type { ChatProvider } from "@/lib/services/chatNotifications";
import { saveChatWebhookAction, saveSlackBotAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import ConnectCards from "@/components/patterns/admin/ConnectCards";
import FormGrid from "@/components/patterns/admin/FormGrid";
import TogglesList from "@/components/patterns/admin/TogglesList";
import Note from "@/components/patterns/admin/Note";

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

const inputCls =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] placeholder-[#a19d90] font-mono outline-none focus:border-[#b7452f]";

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

  const [botFields, setBotFields] = useState(slackBot);
  const [botSaved, setBotSaved] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const botConfigured = !!(botFields.botToken && botFields.signingSecret && botFields.workspaceId);

  // "Which events post" — this app doesn't persist per-event toggles yet; reflect
  // the fixed rule set the notifier actually fires on (see save() / server notifier).
  const [eventToggles, setEventToggles] = useState({
    created: true,
    comment: true,
    urgent: true,
  });

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
      <PageHeader
        title="Chat Notifications"
        subtitle="Slack, Microsoft Teams, and Discord"
        right={
          connected > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: "#3f7d4c", backgroundColor: "#e9f3ea" }}
            >
              {connected} channel{connected > 1 ? "s" : ""} connected
            </span>
          ) : undefined
        }
      />

      <div className="space-y-6 px-6">
        <ConnectCards
          items={PROVIDERS.map(({ key, label, icon }) => ({
            key,
            name: label,
            description: PROVIDERS.find((p) => p.key === key)?.hint,
            icon,
            connected: !!values[key]?.trim(),
            onAction: () => {
              const el = document.getElementById(`chat-field-${key}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              (el as HTMLInputElement | null)?.focus();
            },
          }))}
        />

        {PROVIDERS.map(({ key, label }) => {
          const isConnected = !!values[key]?.trim();
          return (
            <div key={key} className="space-y-2">
              <h2 className="text-[12.5px] font-bold text-[#20201d]">{label} webhook URL</h2>
              {errors[key] && <Note icon="⚠" tone="error">{errors[key]}</Note>}
              <div className="flex gap-2">
                <input
                  id={`chat-field-${key}`}
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/..."
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => save(key)}
                  disabled={isPending}
                  className="shrink-0 rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                  style={{ background: saved === key ? "#3f7d4c" : "linear-gradient(160deg,#9a5138,#6e3324)" }}
                >
                  {saved === key ? "✓ Saved" : isConnected ? "Update" : "Connect"}
                </button>
                {isConnected && saved !== key && (
                  <button
                    type="button"
                    onClick={() => {
                      setValues((v) => ({ ...v, [key]: "" }));
                      saveChatWebhookAction(slug, key, "").catch(() => null);
                    }}
                    className="shrink-0 rounded-[5px] border border-[#ddd8c9] bg-[#f4f2eb] px-3.5 py-[7px] text-[12px] font-semibold text-[#4a473e] hover:bg-[#eae6da]"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Slack bot credentials</h2>
          <p className="mb-3 text-[11.5px] text-[#726e60]">
            Inbound — enables <code className="font-mono">/forge [title]</code> slash command and 🐛 reaction → issue creation.
          </p>
          {botError && <Note icon="⚠" tone="error">{botError}</Note>}
          <FormGrid
            fields={[
              {
                key: "botToken",
                label: "Bot User OAuth Token (starts with xoxb-)",
                input: (
                  <input
                    type="password"
                    value={botFields.botToken}
                    onChange={(e) => setBotFields((f) => ({ ...f, botToken: e.target.value }))}
                    placeholder="xoxb-..."
                    className={inputCls}
                  />
                ),
              },
              {
                key: "signingSecret",
                label: "Signing Secret",
                input: (
                  <input
                    type="password"
                    value={botFields.signingSecret}
                    onChange={(e) => setBotFields((f) => ({ ...f, signingSecret: e.target.value }))}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className={inputCls}
                  />
                ),
              },
              {
                key: "workspaceId",
                label: "Workspace ID (starts with T)",
                input: (
                  <input
                    value={botFields.workspaceId}
                    onChange={(e) => setBotFields((f) => ({ ...f, workspaceId: e.target.value }))}
                    placeholder="T0XXXXXXXXX"
                    className={inputCls}
                  />
                ),
              },
            ]}
            onCancel={botConfigured ? clearBot : undefined}
            onSubmit={saveBot}
            submitLabel={botSaved ? "✓ Saved" : botConfigured ? "Update" : "Save"}
          />
          {botConfigured && (
            <div className="mt-3">
              <Note icon="ℹ" tone="info">
                Endpoint URLs for your Slack app — slash command: <code className="font-mono">/api/slack/slash</code>, event subscriptions: <code className="font-mono">/api/slack/events</code>
              </Note>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Which events post</h2>
          <TogglesList
            items={[
              { key: "created", label: "Issue created", description: "Any new issue in any project", on: eventToggles.created },
              { key: "comment", label: "Comment posted", description: "New comment on any issue", on: eventToggles.comment },
              { key: "urgent", label: "Priority changed to Urgent", description: "Issue escalated to urgent priority", on: eventToggles.urgent },
            ]}
            onChange={(key, next) => setEventToggles((t) => ({ ...t, [key]: next }))}
          />
          <p className="mt-2 text-[11px] text-[#a19d90]">Leave a webhook URL blank (or click Disconnect) to disable that provider entirely.</p>
        </div>
      </div>
    </div>
  );
}
