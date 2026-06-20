"use client";

import { useState, useTransition } from "react";
import type { WebhookEndpoint } from "@/lib/repositories/webhooks";
import { createWebhookAction, toggleWebhookAction, deleteWebhookAction, testWebhookAction } from "./actions";

const EVENT_LABELS: Record<string, string> = {
  "issue.created": "Issue created",
  "issue.updated": "Issue updated",
  "issue.deleted": "Issue deleted",
  "comment.created": "Comment posted",
};

export default function WebhooksClient({
  slug,
  endpoints,
  allEvents,
}: {
  slug: string;
  endpoints: WebhookEndpoint[];
  allEvents: string[];
}) {
  const [list, setList] = useState(endpoints);
  const [adding, setAdding] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; status?: number; error?: string }>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createWebhookAction(slug, formData);
        setAdding(false);
        // Refresh by reloading — server action revalidates the path
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

  return (
    <div className="space-y-4">
      {/* Endpoint list */}
      {list.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-400">
          No webhooks yet. Add one to start receiving events.
        </div>
      )}

      {list.map((ep) => (
        <div key={ep.id} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-neutral-800 truncate">{ep.url}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {ep.events.map((e) => (
                  <span key={e} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                    {EVENT_LABELS[e] ?? e}
                  </span>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={ep.enabled}
                onChange={(e) => handleToggle(ep.id, e.target.checked)}
                disabled={pending}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-xs text-neutral-500">{ep.enabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>

          {/* Secret */}
          <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs font-mono text-neutral-500">
            <span className="text-neutral-400 shrink-0">Secret:</span>
            <span className="flex-1 truncate">
              {revealSecret === ep.id ? ep.secret : "••••••••••••••••••••••••"}
            </span>
            <button onClick={() => setRevealSecret(revealSecret === ep.id ? null : ep.id)}
              className="shrink-0 text-neutral-400 hover:text-neutral-700 text-[11px]">
              {revealSecret === ep.id ? "Hide" : "Reveal"}
            </button>
          </div>

          {/* Test result */}
          {testResults[ep.id] && (
            <p className={`text-xs px-3 py-1.5 rounded-lg ${testResults[ep.id].ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResults[ep.id].ok
                ? `✓ Delivered (HTTP ${testResults[ep.id].status})`
                : `✗ Failed${testResults[ep.id].status ? ` (HTTP ${testResults[ep.id].status})` : ""}: ${testResults[ep.id].error ?? "unknown error"}`}
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => handleTest(ep.id)} disabled={pending}
              className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
              Send test
            </button>
            <button onClick={() => handleDelete(ep.id)} disabled={pending}
              className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
              Delete
            </button>
          </div>
        </div>
      ))}

      {/* Add form */}
      {adding ? (
        <form action={handleCreate} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-4">
          <p className="text-sm font-medium text-neutral-800">New webhook endpoint</p>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">URL</label>
            <input name="url" required placeholder="https://hooks.slack.com/…"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Events</label>
            <div className="space-y-1.5">
              {allEvents.map((e) => (
                <label key={e} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name={`event_${e}`} defaultChecked className="h-4 w-4 rounded border-neutral-300" />
                  <span className="text-sm text-neutral-700">{EVENT_LABELS[e] ?? e}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
              {pending ? "Creating…" : "Create webhook"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null); }}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-500 hover:bg-neutral-50 transition">
          + Add webhook endpoint
        </button>
      )}

      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-xs text-neutral-500 space-y-1">
        <p className="font-medium text-neutral-700">Verifying signatures</p>
        <p>Each request includes an <code className="font-mono bg-white px-1 rounded">X-Forge-Signature: sha256=&lt;hex&gt;</code> header.</p>
        <p>Compute <code className="font-mono bg-white px-1 rounded">HMAC-SHA256(secret, raw_body)</code> and compare to verify authenticity.</p>
      </div>
    </div>
  );
}
