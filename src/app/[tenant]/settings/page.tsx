import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NotificationPrefsClient from "./NotificationPrefsClient";
import SessionManagement from "./SessionManagement";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();
  const [userRowRes, sessionRes] = await Promise.all([
    supabase.from("users").select("notification_prefs").eq("id", ctx.appUserId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const initialPrefs = (userRowRes.data?.notification_prefs as Record<string, boolean> | null) ?? {};
  const lastSignIn = sessionRes.data.user?.last_sign_in_at ?? null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500">Manage your account preferences.</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Notification preferences</h2>
        <NotificationPrefsClient slug={slug} initialPrefs={initialPrefs} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Sessions &amp; security</h2>
        <SessionManagement lastSignIn={lastSignIn} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Availability</h2>
        <Link
          href={`/${slug}/settings/availability`}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
        >
          Set your working hours &amp; days →
        </Link>
      </div>
    </div>
  );
}
