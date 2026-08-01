"use client";

import { useState, useTransition } from "react";
import type { WebhookEndpointMeta } from "@/lib/repositories/webhooks";
import { createWebhookAction, toggleWebhookAction, deleteWebhookAction, testWebhookAction, revealSecretAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import AdminTable from "@/components/patterns/admin/AdminTable";
import FormGrid from "@/components/patterns/admin/FormGrid";
import Note from "@/components/patterns/admin/Note";
import Toggle from "@/components/patterns/Toggle";

const EVENT_LABELS: Record<string, string> = {
  "issue.created": "Issue created",
  "issue.updated": "Issue updated",
  "issue.deleted": "Issue deleted",
  "comment.created": "Comment posted",
};

const inputCls =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] placeholder-[#a19d90] outline-none focus:border-[#b7452f]";

export default function WebhooksClient({
  slug,
  endpoints,
  allEvents,
}: {
  slug: string;
  endpoints: WebhookEndpointMeta[];
  allEvents: string[];
}) {
  const [list, setList] = useState(endpoints);
  const [adding, setAdding] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; status?: number; error?: string }>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealPending, setRevealPending] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createWebhookAction(slug, formData);
        setAdding(false);
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create webhook");
      }
    });
  }

  function handleToggle(id: string, enabled: boolean) {
    startTransition(async () => {
      await toggleWebhookAction(slug, id, enabled);
      setList((l) => l.map((e) => e.id === id ? { ...e, enabled } : e));
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this webhook endpoint?")) return;
    startTransition(async () => {
      await deleteWebhookAction(slug, id);
      setList((l) => l.filter((e) => e.id !== id));
    });
  }

  function handleTest(id: string) {
    startTransition(async () => {
      const result = await testWebhookAction(slug, id);
      setTestResults((r) => ({ ...r, [id]: result }));
    });
  }

  async function toggleReveal(id: string) {
    if (revealSecret === id) { setRevealSecret(null); return; }
    if (revealedSecrets[id]) { setRevealSecret(id); return; }
    setRevealPending(id);
    try {
      const secret = await revealSecretAction(slug, id);
      if (secret) setRevealedSecrets((s) => ({ ...s, [id]: secret }));
      setRevealSecret(id);
    } finally { setRevealPending(null); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" subtitle="Send issue events to your own endpoints" />

      <div className="space-y-6 px-6">
        {error && <Note icon="⚠" tone="error">{error}</Note>}

        <div>
          <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Endpoints</h2>
          {list.length === 0 ? (
            <p className="text-[11.5px] text-[#a19d90]">No webhooks yet. Add one below to start receiving events.</p>
          ) : (
            <AdminTable
              minWidth={720}
              columns={[
                { label: "URL", flex: true },
                { label: "Events", width: 220 },
                { label: "Status", width: 90 },
                { label: "Last delivery", width: 150 },
                { label: "", width: 140 },
              ]}
              rows={list.map((ep) => {
                const result = testResults[ep.id];
                const failing = result && !result.ok;
                return [
                  { kind: "mono", value: ep.url },
                  {
                    kind: "dim",
                    value: ep.events.map((e) => EVENT_LABELS[e] ?? e).join(", "),
                  },
                  {
                    kind: "chip",
                    value: failing ? "Failing" : ep.enabled ? "Active" : "Disabled",
                    chipFg: failing ? "#c0392b" : ep.enabled ? "#3f7d4c" : "#a19d90",
                    chipBg: failing ? "#fbeae8" : ep.enabled ? "#e9f3ea" : "#f1efe9",
                  },
                  {
                    kind: "dim",
                    value: result
                      ? result.ok
                        ? `✓ HTTP ${result.status}`
                        : `✗ ${result.status ? `HTTP ${result.status}` : result.error ?? "failed"}`
                      : "—",
                  },
                  {
                    kind: "text",
                    value: (
                      <span className="flex items-center gap-2.5 text-[11.5px]">
                        <button type="button" onClick={() => handleTest(ep.id)} disabled={pending} className="font-semibold text-[#b7452f] hover:underline disabled:opacity-50">
                          Test
                        </button>
                        <span className="text-[#ddd8c9]">·</span>
                        <button type="button" onClick={() => handleDelete(ep.id)} disabled={pending} className="font-semibold text-[#c0392b] hover:underline disabled:opacity-50">
                          Delete
                        </button>
                      </span>
                    ),
                  },
                ];
              })}
            />
          )}
        </div>

        {list.length > 0 && (
          <div className="space-y-3">
            {list.map((ep) => (
              <div key={ep.id} className="fw-card flex items-center gap-3 px-3.5 py-3">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#726e60]">{ep.url}</span>
                <span className="shrink-0 flex-1 truncate text-[11px] text-[#a19d90]">
                  {revealSecret === ep.id && revealedSecrets[ep.id] ? revealedSecrets[ep.id] : "••••••••••••••••••••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleReveal(ep.id)}
                  disabled={revealPending === ep.id}
                  className="shrink-0 text-[11px] font-semibold text-[#b7452f] hover:underline disabled:opacity-50"
                >
                  {revealPending === ep.id ? "…" : revealSecret === ep.id ? "Hide secret" : "Reveal secret"}
                </button>
                <Toggle on={ep.enabled} onChange={(next) => handleToggle(ep.id, next)} label={`Enable ${ep.url}`} />
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div>
            <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">New endpoint</h2>
            <form action={handleCreate}>
              <FormGrid
                fields={[
                  {
                    key: "url",
                    label: "URL",
                    input: <input name="url" required placeholder="https://hooks.slack.com/…" className={inputCls} />,
                  },
                  {
                    key: "events",
                    label: "Events",
                    input: (
                      <div className="flex flex-col gap-1.5 pt-1">
                        {allEvents.map((e) => (
                          <label key={e} className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              name={`event_${e}`}
                              defaultChecked
                              className="h-3.5 w-3.5 rounded border-[#ddd8c9]"
                            />
                            <span className="text-[12px] text-[#4a473e]">{EVENT_LABELS[e] ?? e}</span>
                          </label>
                        ))}
                      </div>
                    ),
                  },
                ]}
                onCancel={() => { setAdding(false); setError(null); }}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8] disabled:opacity-50"
                  style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
                >
                  {pending ? "Creating…" : "Create endpoint"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-[6px] border border-dashed border-[#ddd8c9] bg-[#faf8f2] py-3 text-[12px] font-semibold text-[#726e60] hover:bg-[#f4f2eb]"
          >
            + Add webhook endpoint
          </button>
        )}

        <Note icon="🔒" tone="info">
          Each request includes an <code className="font-mono">X-Forge-Signature: sha256=&lt;hex&gt;</code> header. Compute{" "}
          <code className="font-mono">HMAC-SHA256(secret, raw_body)</code> and compare to verify authenticity.
        </Note>
      </div>
    </div>
  );
}
