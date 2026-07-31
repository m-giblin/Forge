import { describeInvite } from "@/lib/services/members";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import JoinClient from "./JoinClient";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const desc = await describeInvite(token);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--fw-cream)] px-4 font-[family-name:var(--font-inter)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/forge-logo.svg" alt="Forge-Worx" className="mx-auto h-16 w-16 object-contain drop-shadow-md" />
        </div>
        {!desc.valid ? (
          <div className="rounded-xl border border-[var(--fw-cream-border)] bg-white p-6 text-center text-sm text-[#726e60] shadow-sm">
            {desc.reason}
          </div>
        ) : (
          <JoinClient
            token={token}
            tenantName={desc.tenantName}
            role={desc.role}
            boundEmail={desc.email}
            currentEmail={user?.email ?? null}
          />
        )}
      </div>
    </main>
  );
}
