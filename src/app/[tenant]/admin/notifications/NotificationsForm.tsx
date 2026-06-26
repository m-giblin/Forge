"use client";

import { useState, useTransition } from "react";
import { saveNotificationSettingsAction } from "./actions";

type Settings = {
  resendApiKey: string;
  emailDisplayName: string;
  emailPrimaryColor: string;
  emailFromName: string;
  standupEmailRecipients: string;
};

export default function NotificationsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: Settings;
}) {
  const [form, setForm] = useState<Settings>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(key: keyof Settings, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveNotificationSettingsAction(slug, form);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  const keyPreview =
    form.resendApiKey.length > 12
      ? form.resendApiKey.slice(0, 8) + "•".repeat(16)
      : form.resendApiKey;

  return (
    <div className="mt-6 max-w-xl space-y-5">

      {/* Email provider — platform-level */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Email provider</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Forge uses{" "}
          <a href="https://resend.com" className="underline" target="_blank" rel="noreferrer">Resend</a>
          {" "}to send assignment notifications. Leave blank to disable emails.
        </p>
        <label className="mt-4 block text-xs font-medium text-neutral-700">
          Resend API key
          <input
            type="password"
            value={form.resendApiKey}
            onChange={(e) => set("resendApiKey", e.target.value)}
            placeholder="re_••••••••••••••••••••••"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono outline-none focus:border-neutral-900"
          />
          {form.resendApiKey && (
            <span className="mt-1 block text-xs text-neutral-400">Stored as: {keyPreview}</span>
          )}
        </label>
      </div>

      {/* Per-tenant email branding */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Email branding</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Customize how notification emails appear to your team. These settings apply only to this workspace.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-neutral-700">
            Display name
            <span className="ml-1 font-normal text-neutral-400">— shown in email header and footer</span>
            <input
              type="text"
              value={form.emailDisplayName}
              onChange={(e) => set("emailDisplayName", e.target.value)}
              placeholder="e.g. Travli Engineering"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </label>
          <label className="block text-xs font-medium text-neutral-700">
            Sender name
            <span className="ml-1 font-normal text-neutral-400">— appears as the &ldquo;From&rdquo; name in email clients</span>
            <input
              type="text"
              value={form.emailFromName}
              onChange={(e) => set("emailFromName", e.target.value)}
              placeholder="e.g. Travli via Forge"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </label>
          <label className="block text-xs font-medium text-neutral-700">
            Primary color
            <span className="ml-1 font-normal text-neutral-400">— email header background</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={form.emailPrimaryColor || "#111827"}
                onChange={(e) => set("emailPrimaryColor", e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-lg border border-neutral-300 p-1"
              />
              <input
                type="text"
                value={form.emailPrimaryColor}
                onChange={(e) => set("emailPrimaryColor", e.target.value)}
                placeholder="#111827"
                className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono outline-none focus:border-neutral-900"
              />
              <span className="text-xs text-neutral-400">hex value</span>
            </div>
          </label>
        </div>
      </div>

      {/* Standup digest email recipients */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Daily Standup Digest — Email Recipients</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Standup digests are generated daily at 9 AM UTC. Add comma-separated email addresses to receive them.
            Leave blank to send to Slack only.
          </p>
        </div>
        <textarea
          rows={3}
          value={form.standupEmailRecipients}
          onChange={(e) => set("standupEmailRecipients", e.target.value)}
          placeholder="cto@company.com, team@company.com"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 resize-none"
        />
      </div>

      {/* What triggers emails */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Triggers</h3>
        <ul className="mt-2 space-y-2 text-sm text-neutral-600">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[9px] text-white">✓</span>
            <span><strong>Assignment</strong> — ticket assigned to someone → email with their full open queue + unassigned count.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[9px] text-neutral-400">—</span>
            <span className="text-neutral-400">SLA breach alerts — coming soon.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[9px] text-neutral-400">—</span>
            <span className="text-neutral-400">Comment @mentions — coming soon.</span>
          </li>
        </ul>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved ✓</p>}

      <button
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
