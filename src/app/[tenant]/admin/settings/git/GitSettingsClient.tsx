"use client";

import { useState, useTransition } from "react";
import type { GitConnection, GitRepoLink } from "@/lib/repositories/gitIntegration";
import type { Project } from "@/lib/services/issues";
import { connectGitHubAction, disconnectGitHubAction, addRepoLinkAction, removeRepoLinkAction } from "./actions";

export default function GitSettingsClient({
  slug,
  connection,
  repoLinks,
  projects,
  webhookUrl,
}: {
  slug: string;
  connection: GitConnection | null;
  repoLinks: GitRepoLink[];
  projects: Project[];
  webhookUrl: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [repoName, setRepoName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");

  function connect() {
    startTransition(async () => {
      try {
        const { secret: s } = await connectGitHubAction(slug);
        setSecret(s);
      } catch (e) { setError(String(e)); }
    });
  }

  function disconnect() {
    if (!confirm("Disconnect GitHub? Existing code links will be preserved.")) return;
    startTransition(() => disconnectGitHubAction(slug));
  }

  function addRepo() {
    if (!repoName.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await addRepoLinkAction(slug, repoName.trim(), projectId);
        setRepoName(""); setProjectId("");
      } catch (e) { setError(String(e)); }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">GitHub Integration</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Link pull requests to issues and auto-close on merge</p>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded p-3">{error}</p>}

      {/* Connection status */}
      <div className="border border-zinc-700 rounded-lg p-5 bg-zinc-800/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${connection ? "bg-green-400" : "bg-zinc-500"}`} />
            <span className="text-sm font-medium text-white">
              {connection ? "Connected" : "Not connected"}
            </span>
          </div>
          {connection ? (
            <button onClick={disconnect} disabled={isPending} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
              Disconnect
            </button>
          ) : (
            <button onClick={connect} disabled={isPending} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50">
              {isPending ? "Connecting…" : "Connect GitHub"}
            </button>
          )}
        </div>

        {/* Show secret after connecting */}
        {secret && (
          <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-300">Webhook secret — copy now, won&apos;t be shown again</p>
            <code className="block text-xs text-amber-100 font-mono break-all bg-black/20 rounded p-2">{secret}</code>
          </div>
        )}

        {connection && (
          <div className="space-y-3 mt-2">
            <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-300">Webhook URL</p>
              <code className="block text-xs text-zinc-100 font-mono break-all">{webhookUrl}</code>
              <p className="text-xs text-zinc-500">Add this URL to your GitHub repo: Settings → Webhooks → Add webhook</p>
              <p className="text-xs text-zinc-500">Events: <strong className="text-zinc-300">Pull requests</strong> and <strong className="text-zinc-300">Pushes</strong></p>
            </div>

            <div className="bg-zinc-900 rounded-lg p-4 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-300">How it works</p>
              <p>• Mention <code className="text-indigo-300">FORGE-123</code> in a PR title or body to link it to that issue</p>
              <p>• Use <code className="text-indigo-300">closes FORGE-123</code> or <code className="text-indigo-300">fixes FORGE-123</code> to auto-close on merge</p>
            </div>
          </div>
        )}
      </div>

      {/* Repo links */}
      {connection && (
        <div className="border border-zinc-700 rounded-lg p-5 bg-zinc-800/40 space-y-4">
          <h3 className="text-sm font-semibold text-white">Linked Repositories</h3>

          {repoLinks.length === 0 && (
            <p className="text-xs text-zinc-500">No repos linked yet. Add one below.</p>
          )}

          <div className="space-y-2">
            {repoLinks.map((link) => {
              const proj = projects.find((p) => p.id === link.projectId);
              return (
                <div key={link.id} className="flex items-center justify-between text-sm bg-zinc-900 rounded-lg px-4 py-2.5">
                  <div>
                    <span className="font-mono text-zinc-200">{link.repoFullName}</span>
                    {proj && <span className="ml-2 text-xs text-zinc-400">→ {proj.name}</span>}
                  </div>
                  <button
                    onClick={() => startTransition(() => removeRepoLinkAction(slug, link.id))}
                    className="text-xs text-zinc-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="owner/repo (e.g. acme/web)"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white placeholder-zinc-500"
            />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="">Any project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={addRepo}
              disabled={isPending || !repoName.trim()}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
