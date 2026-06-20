import type { IssueCodeLink } from "@/lib/repositories/gitIntegration";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  merged: { label: "Merged", cls: "bg-purple-100 text-purple-700" },
  open:   { label: "Open",   cls: "bg-green-100 text-green-700" },
  closed: { label: "Closed", cls: "bg-neutral-100 text-neutral-500" },
};

export default function GitLinksCard({ links }: { links: IssueCodeLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Pull Requests</p>
      <div className="space-y-1.5">
        {links.map((link) => {
          const badge = STATE_BADGE[link.prState ?? "open"] ?? STATE_BADGE.open;
          return (
            <div key={link.id} className="flex items-start gap-2 text-sm">
              <svg className="h-4 w-4 shrink-0 mt-0.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <div className="flex-1 min-w-0">
                {link.prUrl ? (
                  <a href={link.prUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline truncate block">
                    {link.prTitle ?? `#${link.prNumber}`}
                  </a>
                ) : (
                  <span className="font-medium text-neutral-700">{link.prTitle ?? `#${link.prNumber}`}</span>
                )}
                <span className="text-xs text-neutral-400">{link.repoFullName} #{link.prNumber}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
