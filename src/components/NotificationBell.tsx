"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Notification } from "@/lib/repositories/notifications";
import { markAllReadAction } from "@/app/[tenant]/notifications/actions";

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function NotificationBell({
  slug,
  userId,
  tenantId,
  initialCount,
  initialNotifications,
  unassignedCount,
}: {
  slug: string;
  userId: string;
  tenantId: string;
  initialCount: number;
  initialNotifications: Notification[];
  unassignedCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Realtime: listen for new notifications for this user.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`notifications:${tenantId}:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const n: Notification = {
              id: row.id as string,
              tenantId: row.tenant_id as string,
              userId: row.user_id as string,
              type: row.type as string,
              title: row.title as string,
              body: (row.body as string | null) ?? null,
              issueId: (row.issue_id as string | null) ?? null,
              readAt: null,
              createdAt: row.created_at as string,
            };
            setNotifications((prev) => [n, ...prev]);
            setCount((c) => c + 1);
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  function handleMarkAllRead() {
    setCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    startTransition(() => markAllReadAction(slug));
  }

  function handleNotificationClick(n: Notification) {
    setOpen(false);
    if (n.issueId) router.push(`/${slug}/issues/${n.issueId}`);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-xl border border-neutral-200 bg-white shadow-xl">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <span className="text-sm font-semibold text-neutral-900">Notifications</span>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Unassigned queue callout */}
          {unassignedCount > 0 && (
            <div
              className="mx-3 mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 hover:bg-amber-100"
              onClick={() => { setOpen(false); router.push(`/${slug}/board`); }}
            >
              <span className="text-base">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  {unassignedCount} unassigned ticket{unassignedCount !== 1 ? "s" : ""} in the queue
                </p>
                <p className="text-xs text-amber-700">No one is on these yet — click to review</p>
              </div>
            </div>
          )}

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">No new notifications</p>
            ) : (
              <ul className="divide-y divide-neutral-50 py-1">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-neutral-50 ${
                      !n.readAt ? "bg-blue-50/40" : ""
                    }`}
                  >
                    {/* Unread dot */}
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        !n.readAt ? "bg-blue-500" : "bg-transparent"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{n.title}</p>
                      {n.body && <p className="text-xs text-neutral-500">{n.body}</p>}
                      <p className="mt-0.5 text-xs text-neutral-400">{relTime(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-100 px-4 py-2">
            <p className="text-xs text-neutral-400">Assigned tickets trigger email + in-app notifications.</p>
          </div>
        </div>
      )}
    </div>
  );
}
