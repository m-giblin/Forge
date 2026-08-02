"use client";

import { useState, useTransition } from "react";
import type { GitConnection, GitRepoLink, MergeWorkflow } from "@/lib/repositories/gitIntegration";
import type { Project } from "@/lib/services/issues";
import { connectGitHubAction, disconnectGitHubAction, addRepoLinkAction, removeRepoLinkAction, setMergeWorkflowAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import ConnectCards from "@/components/patterns/admin/ConnectCards";
import AdminTable from "@/components/patterns/admin/AdminTable";
import FormGrid from "@/components/patterns/admin/FormGrid";
import Note from "@/components/patterns/admin/Note";

const inputCls =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-[7px] text-[12.5px] text-[#20201d] placeholder-[#a19d90] outline-none focus:border-[#b7452f]";

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

  function changeMergeWorkflow(value: string) {
    startTransition(async () => {
      try {
        await setMergeWorkflowAction(slug, value as MergeWorkflow);
      } catch (e) { setError(String(e)); }
    });
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
      <PageHeader title="GitHub Integration" subtitle="Link branches and PRs to issues" />

      <div className="space-y-6 px-6">
        {error && <Note icon="⚠" tone="error">{error}</Note>}

        <ConnectCards
          items={[
            {
              key: "github",
              name: "GitHub",
              icon: "🐙",
              description: connection
                ? `Connected to ${connection.accountLogin ?? "your account"}. Branch and PR events sync to issue Development panels.`
                : "Connect a GitHub account to link branches and PRs to issues.",
              connected: !!connection,
              onAction: connection ? disconnect : connect,
            },
          ]}
        />

        {isPending && !connection && !secret && (
          <p className="text-[11.5px] text-[#a19d90]">Connecting…</p>
        )}

        {secret && (
          <Note icon="🔑" tone="warning">
            Webhook secret — copy now, won&apos;t be shown again: <code className="font-mono">{secret}</code>
          </Note>
        )}

        {connection && (
          <>
            <div className="fw-card px-4 py-4 space-y-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">Webhook URL</p>
              <code className="block break-all rounded-[5px] bg-[#f4f2eb] px-2.5 py-2 font-mono text-[11px] text-[#4a473e]">{webhookUrl}</code>
              <p className="text-[11.5px] text-[#726e60]">Add this URL to your GitHub repo: Settings → Webhooks → Add webhook</p>
              <p className="text-[11.5px] text-[#726e60]">Events: <strong className="text-[#20201d]">Pull requests</strong> and <strong className="text-[#20201d]">Pushes</strong></p>
            </div>

            <Note icon="ℹ" tone="info">
              Mention <code className="font-mono">FORGE-123</code> in a PR title/body to link it. Use <code className="font-mono">closes FORGE-123</code> or <code className="font-mono">fixes FORGE-123</code> to auto-close on merge.
            </Note>

            <div className="fw-card px-4 py-4 space-y-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#a19d90]">On PR merge</p>
              <select
                value={connection.mergeWorkflow}
                onChange={(e) => changeMergeWorkflow(e.target.value)}
                className={inputCls}
              >
                <option value="keyword_or_solo">Close on keyword, or if only one ticket is linked (default)</option>
                <option value="always_close">Close every linked ticket, keyword not required</option>
                <option value="link_only">Never auto-close — just link the PR to the ticket</option>
              </select>
              <p className="text-[11.5px] text-[#726e60]">
                Controls what happens to a ticket when a linked pull request is merged. Applies to every repo connected here.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Linked repositories</h2>
              {repoLinks.length === 0 ? (
                <p className="text-[11.5px] text-[#a19d90]">No repos linked yet. Add one below.</p>
              ) : (
                <AdminTable
                  columns={[
                    { label: "Repository", flex: true },
                    { label: "Linked project", width: 180 },
                    { label: "", width: 90 },
                  ]}
                  rows={repoLinks.map((link) => {
                    const proj = projects.find((p) => p.id === link.projectId);
                    return [
                      { kind: "mono", value: link.repoFullName },
                      { kind: "dim", value: proj ? proj.name : "Any project" },
                      {
                        kind: "link",
                        value: "Remove",
                        onClick: () => startTransition(() => removeRepoLinkAction(slug, link.id)),
                      },
                    ];
                  })}
                />
              )}
            </div>

            <h2 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Link a repository</h2>
            <FormGrid
              fields={[
                {
                  key: "repo",
                  label: "Repository",
                  input: (
                    <input
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="owner/repo (e.g. acme/web)"
                      className={inputCls}
                    />
                  ),
                },
                {
                  key: "project",
                  label: "Project",
                  input: (
                    <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
                      <option value="">Any project</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ),
                },
              ]}
              onSubmit={addRepo}
              submitLabel="Link repo"
            />
          </>
        )}
      </div>
    </div>
  );
}
