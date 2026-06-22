import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NotificationPrefsClient from "./NotificationPrefsClient";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("notification_prefs")
    .eq("id", ctx.appUserId)
    .maybeSingle();

  const initialPrefs = (userRow?.notification_prefs as Record<string, boolean> | null) ?? {};

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold text-neutral-900">Settings</h1>
      <p className="mb-6 text-sm text-neutral-500">Manage your notification preferences.</p>

      <h2 className="mb-3 text-sm font-semibold text-neutral-700">Notification preferences</h2>
      <NotificationPrefsClient slug={slug} initialPrefs={initialPrefs} />
    </div>
  );
}
