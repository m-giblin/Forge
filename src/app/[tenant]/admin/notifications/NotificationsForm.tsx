"use client";

import { useState, useTransition } from "react";
import { saveNotificationSettingsAction } from "./actions";
import FormGrid from "@/components/patterns/admin/FormGrid";
import AdminList from "@/components/patterns/admin/AdminList";

type Settings = {
  resendApiKey: string;
  emailDisplayName: string;
  emailPrimaryColor: string;
  emailFromName: string;
  standupEmailRecipients: string;
};

const fieldClass =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12px] text-[#20201d] outline-none focus:border-[#b7452f]";

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
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">Email sender</h2>
        <FormGrid
          submitLabel={pending ? "Saving…" : "Save"}
          onSubmit={save}
          fields={[
            {
              key: "resendApiKey",
              label: "Provider API key",
              input: (
                <div>
                  <input
                    type="password"
                    value={form.resendApiKey}
                    onChange={(e) => set("resendApiKey", e.target.value)}
                    placeholder="re_••••••••••••••••••••••"
                    className={`${fieldClass} font-mono`}
                  />
                  {form.resendApiKey && (
                    <span className="mt-1 block text-[10.5px] text-[#a19d90]">Stored as: {keyPreview}</span>
                  )}
                </div>
              ),
            },
            {
              key: "emailFromName",
              label: "From name",
              input: (
                <input
                  type="text"
                  value={form.emailFromName}
                  onChange={(e) => set("emailFromName", e.target.value)}
                  placeholder="e.g. Forge Engineering"
                  className={fieldClass}
                />
              ),
            },
            {
              key: "emailDisplayName",
              label: "Display name",
              input: (
                <input
                  type="text"
                  value={form.emailDisplayName}
                  onChange={(e) => set("emailDisplayName", e.target.value)}
                  placeholder="Shown in email header and footer"
                  className={fieldClass}
                />
              ),
            },
            {
              key: "emailPrimaryColor",
              label: "Brand color",
              input: (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.emailPrimaryColor || "#111827"}
                    onChange={(e) => set("emailPrimaryColor", e.target.value)}
                    className="h-[30px] w-11 shrink-0 cursor-pointer rounded-[5px] border border-[#ddd8c9] p-1"
                  />
                  <input
                    type="text"
                    value={form.emailPrimaryColor}
                    onChange={(e) => set("emailPrimaryColor", e.target.value)}
                    placeholder="#111827"
                    className={`${fieldClass} font-mono`}
                  />
                </div>
              ),
            },
            {
              key: "standupEmailRecipients",
              label: "Digest recipients",
              wide: true,
              input: (
                <textarea
                  rows={2}
                  value={form.standupEmailRecipients}
                  onChange={(e) => set("standupEmailRecipients", e.target.value)}
                  placeholder="cto@company.com, team@company.com"
                  className={`${fieldClass} resize-none`}
                />
              ),
            },
          ]}
        />
      </div>

      <div>
        <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">What we send</h2>
        <AdminList
          items={[
            {
              key: "assignment",
              title: "Assignment emails",
              subline: "Sent when a ticket is assigned — includes their full open queue and unassigned count.",
              badge: <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8c4632] text-[9px] text-white">✓</span>,
              meta: "Active",
            },
            {
              key: "sla",
              title: "SLA breach alerts",
              subline: "Coming soon.",
              badge: <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e3ded0] text-[9px] text-[#a19d90]">—</span>,
              meta: "Planned",
            },
            {
              key: "mentions",
              title: "Comment @mentions",
              subline: "Coming soon.",
              badge: <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e3ded0] text-[9px] text-[#a19d90]">—</span>,
              meta: "Planned",
            },
          ]}
        />
      </div>

      {error && <p className="text-[12px] font-semibold text-[#c0392b]">{error}</p>}
      {saved && <p className="text-[12px] font-semibold text-[#4b7a4f]">Saved ✓</p>}
    </div>
  );
}
