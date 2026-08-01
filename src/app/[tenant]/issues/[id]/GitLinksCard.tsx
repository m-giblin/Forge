import type { IssueCodeLink } from "@/lib/repositories/gitIntegration";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  merged: { label: "Merged", cls: "bg-[#f4ecfa] text-[#7a4fa0]" },
  open:   { label: "Open",   cls: "bg-[#e9f3ea] text-[#3f7d4c]" },
  closed: { label: "Closed", cls: "bg-[#f1efe9] text-[#a19d90]" },
};

type ExtendedLink = IssueCodeLink & { ai_summary?: string | null; commit_sha?: string | null };

function CommitIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 mt-0.5 text-[#a19d90]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="21" />
    </svg>
  );
}

function PRIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 mt-0.5 text-[#a19d90]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export default function GitLinksCard({ links }: { links: ExtendedLink[] }) {
  if (links.length === 0) return null;

  const commits = links.filter((l) => l.linkKind === "commit");
  const prs = links.filter((l) => l.linkKind !== "commit");

  return (
    <div className="rounded-xl border border-[#ddd8c9] bg-[#faf8f2] p-4 space-y-4">
      {prs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#a19d90]">Pull Requests</p>
          <div className="space-y-1.5">
            {prs.map((link) => {
              const badge = STATE_BADGE[link.prState ?? "open"] ?? STATE_BADGE.open;
              return (
                <div key={link.id} className="flex items-start gap-2 text-sm">
                  <PRIcon />
                  <div className="flex-1 min-w-0">
                    {link.prUrl ? (
                      <a href={link.prUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[#b7452f] hover:underline truncate block">
                        {link.prTitle ?? `#${link.prNumber}`}
                      </a>
                    ) : (
                      <span className="font-medium text-[#4a473e]">{link.prTitle ?? `#${link.prNumber}`}</span>
                    )}
                    <span className="text-xs text-[#a19d90]">{link.repoFullName}</span>
                    {link.ai_summary && (
                      <p className="mt-1 text-xs text-[#726e60] italic">{link.ai_summary}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {commits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#a19d90]">Commits</p>
          <div className="space-y-2">
            {commits.map((link) => {
              const shortSha = link.commit_sha?.slice(0, 7) ?? link.prNumber;
              return (
                <div key={link.id} className="flex items-start gap-2 text-sm">
                  <CommitIcon />
                  <div className="flex-1 min-w-0">
                    {link.prUrl ? (
                      <a href={link.prUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[#b7452f] hover:underline">
                        {shortSha}
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-[#4a473e]">{shortSha}</span>
                    )}
                    <span className="ml-1.5 text-xs text-[#726e60] truncate">{link.repoFullName}</span>
                    {link.ai_summary && (
                      <p className="mt-0.5 text-xs text-[#4a473e]">{link.ai_summary}</p>
                    )}
                    {!link.ai_summary && link.prTitle && (
                      <p className="mt-0.5 text-xs text-[#726e60] truncate">{link.prTitle.replace(/^[a-f0-9]{7}:\s*/, "")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
