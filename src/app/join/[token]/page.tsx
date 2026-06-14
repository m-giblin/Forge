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
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Forge</h1>
        </div>
        {!desc.valid ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600 shadow-sm">
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
