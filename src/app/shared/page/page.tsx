import { createSupabaseServiceClient } from "@/lib/supabase/service";
import GuestPageClient from "./GuestPageClient";

// /shared/page?token=xxx&share=xxx  — magic link landing page
// If valid session exists in cookie, show page. Otherwise prompt for email.

export default async function SharedPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; share?: string }>;
}) {
  const { token, share: shareId } = await searchParams;

  if (!shareId) {
    return <ErrorPage message="This link is invalid or has expired." />;
  }

  const svc = createSupabaseServiceClient();

  // Verify share still active
  const { data: share } = await svc
    .from("page_shares")
    .select("id, allowed_domain, page_id, space_id, is_active, pages(id, title, body, icon, updated_at, spaces(name, icon))")
    .eq("id", shareId)
    .eq("is_active", true)
    .single();

  if (!share) {
    return <ErrorPage message="This share link is no longer active or has been revoked." />;
  }

  const rawPage = Array.isArray(share.pages) ? share.pages[0] : share.pages;
  const page = rawPage as unknown as {
    id: string; title: string; body: string; icon: string | null;
    updated_at: string; spaces: { name: string; icon: string } | null;
  } | null;

  return (
    <GuestPageClient
      shareId={shareId}
      magicToken={token ?? null}
      allowedDomain={share.allowed_domain ?? null}
      page={page}
    />
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-lg font-semibold text-neutral-900 mb-2">Access Unavailable</h1>
        <p className="text-sm text-neutral-500">{message}</p>
      </div>
    </div>
  );
}
