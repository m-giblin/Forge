"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ListRow from "@/components/patterns/ListRow";
import { unwatchIssueAction } from "../issues/[id]/actions";

export default function WatchingRow({
  slug,
  issueId,
  issueKey,
  title,
  priorityLabel,
  priorityColor,
  assigneeLabel,
  updatedLabel,
  first,
}: {
  slug: string;
  issueId: string;
  issueKey: string;
  title: string;
  priorityLabel: string | null;
  priorityColor: string;
  assigneeLabel: string;
  updatedLabel: string;
  first: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function unwatch() {
    startTransition(async () => {
      try {
        await unwatchIssueAction(slug, issueId);
        router.refresh();
      } catch {
        // silently ignore — row simply stays if the unwatch fails
      }
    });
  }

  return (
    <ListRow
      first={first}
      issueKey={issueKey}
      title={
        <Link href={`/${slug}/issues/${issueId}`} className="hover:underline">
          {title}
        </Link>
      }
      right={
        <>
          {priorityLabel && (
            <span className="shrink-0 text-[11px] font-bold" style={{ color: priorityColor }}>
              {priorityLabel}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-[#a19d90]">{assigneeLabel}</span>
          <span className="w-14 shrink-0 text-right text-[11px] text-[#c3bda9]">{updatedLabel}</span>
          <button
            type="button"
            onClick={unwatch}
            disabled={pending}
            className="shrink-0 text-[11px] font-bold text-[#b7452f] hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Unwatch"}
          </button>
        </>
      }
    />
  );
}
