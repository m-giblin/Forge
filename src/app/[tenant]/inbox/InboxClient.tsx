"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Notification } from "@/lib/repositories/notifications";
import { markAllReadAction, markReadAction } from "@/app/[tenant]/notifications/actions";

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

type Tab = "all" | "unread" | "read";

export default function InboxClient({
  slug,
  userId,
  tenantId,
  initialNotifications,
}: {
  slug: string;
  userId: string;
  tenantId: string;
  initialNotifications: Notification[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [tab, setTab] = useState<Tab>("all");
  const [, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Realtime: prepend new notifications as they arrive.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`inbox:${tenantId}:${userId}`)
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
              linkPath: (row.link_path as string | null) ?? null,
              readAt: null,
              createdAt: row.created_at as string,
            };
            setNotifications((prev) => [n, ...prev]);
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, tenantId]);

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    startTransition(() => markAllReadAction(slug));
  }

  function handleNotificationClick(n: Notification) {
    // Optimistic mark read
    if (!n.readAt) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      );
      startTransition(() => markReadAction(slug, n.id));
    }
    if (n.linkPath) {
      router.push(n.linkPath);
    } else if (n.issueId) {
      router.push(`/${slug}/issues/${n.issueId}`);
    }
  }

  const filtered = notifications.filter((n) => {
    if (tab === "unread") return !n.readAt;
    if (tab === "read") return !!n.readAt;
    return true;
  });

  const tabCls = (t: Tab) =>
    tab === t
      ? "border-b-2 border-indigo-600 text-indigo-600 font-semibold"
      : "text-neutral-500 hover:text-neutral-800";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">Inbox</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-neutral-500 hover:text-neutral-800 transition"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-neutral-200 mb-4 text-sm">
        {(["all", "unread", "read"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 capitalize transition ${tabCls(t)}`}
          >
            {t}
            {t === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-3xl">
            {tab === "unread" ? "✓" : "🔔"}
          </div>
          <p className="text-base font-medium text-neutral-700">
            {tab === "unread"
              ? "You're all caught up"
              : tab === "read"
              ? "No read notifications yet"
              : "No notifications yet"}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            {tab === "unread"
              ? "Nothing new needs your attention."
              : "Notifications will appear here when activity happens."}
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {filtered.map((n) => (
            <li
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition hover:shadow-sm ${
                !n.readAt
                  ? "border-indigo-100 bg-indigo-50/40 hover:border-indigo-200"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              {/* Unread dot */}
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  !n.readAt ? "bg-indigo-500" : "bg-transparent"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${!n.readAt ? "text-neutral-900" : "text-neutral-600"}`}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">{n.body}</p>
                )}
                <p className="mt-1 text-xs text-neutral-400">{relTime(n.createdAt)}</p>
              </div>
              {(n.linkPath || n.issueId) && (
                <svg
                  className="mt-1 h-4 w-4 shrink-0 text-neutral-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
