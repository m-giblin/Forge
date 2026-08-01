"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Notification } from "@/lib/repositories/notifications";
import { markAllReadAction, markReadAction, deleteNotificationAction } from "@/app/[tenant]/notifications/actions";
import { FilterRow, FilterPill } from "@/components/patterns/FilterRow";
import { avatarColor, initials } from "@/lib/ui/avatar";

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

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    startTransition(() => deleteNotificationAction(slug, id));
  }

  const filtered = notifications.filter((n) => {
    if (tab === "unread") return !n.readAt;
    if (tab === "read") return !!n.readAt;
    return true;
  });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: notifications.length },
    { key: "unread", label: "Unread", count: unreadCount },
    { key: "read", label: "Read", count: notifications.length - unreadCount },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden md:h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-[#ddd8c9] bg-[#eeece4] px-6 pt-4">
        <div className="flex items-center gap-2.5">
          <h1 className="font-[family-name:var(--font-manrope)] text-[21px] font-extrabold text-[#20201d]">
            Inbox
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[#b7452f] px-2 py-0.5 text-[11px] font-extrabold text-[#f2e9d8]">
              {unreadCount}
            </span>
          )}
          <div className="flex-1" />
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="rounded-full border border-[#ddd8c9] bg-[#f4f2eb] px-3 py-1.5 text-[11.5px] font-semibold text-[#4a473e] transition-colors hover:bg-[#eae6da]"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="py-[13px]">
          <FilterRow>
            {tabs.map((t) => (
              <FilterPill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${
                    tab === t.key ? "bg-white/20 text-[#f2e9d8]" : "bg-[#e3ded0] text-[#726e60]"
                  }`}
                >
                  {t.count}
                </span>
              </FilterPill>
            ))}
          </FilterRow>
        </div>
      </div>

      {/* Notification list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 pb-7">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eae6da] text-3xl">
              {tab === "unread" ? "✓" : "🔔"}
            </div>
            <p className="text-[13px] font-medium text-[#20201d]">
              {tab === "unread"
                ? "You're all caught up"
                : tab === "read"
                ? "No read notifications yet"
                : "No notifications yet"}
            </p>
            <p className="mt-1 text-[12.5px] text-[#a19d90]">
              {tab === "unread"
                ? "Nothing new needs your attention."
                : "Notifications will appear here when activity happens."}
            </p>
          </div>
        ) : (
          <ul className="flex max-w-[920px] flex-col gap-2">
            {filtered.map((n) => {
              const key = initials(n.type.replace(/_/g, " "));
              return (
                <li
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-[15px] py-[13px] transition-colors ${
                    !n.readAt ? "border-[#ddd8c9] bg-[#eaf1f8]" : "border-[#ddd8c9] bg-[#f4f2eb]"
                  }`}
                >
                  <div
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: avatarColor(n.type) }}
                  >
                    {key}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12.5px] leading-[1.45] ${!n.readAt ? "font-semibold text-[#20201d]" : "text-[#4a473e]"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <div className="mt-[5px] rounded-[5px] bg-[#eae6da] px-2.5 py-[7px] text-[12px] text-[#4a473e]">
                        {n.body}
                      </div>
                    )}
                    <p className="mt-[5px] text-[11px] text-[#a19d90]">{relTime(n.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, n.id)}
                      className="rounded-md p-1.5 text-[#a19d90] transition-colors hover:bg-[#eae6da] hover:text-[#c0392b]"
                      title="Delete notification"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {(n.linkPath || n.issueId) && (
                      <svg
                        className="h-3.5 w-3.5 text-[#c3bda9]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: !n.readAt ? "#b7452f" : "transparent" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
