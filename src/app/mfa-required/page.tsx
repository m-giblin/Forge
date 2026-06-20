import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MfaWall from "./MfaWall";

export default async function MfaRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/" } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/mfa-required?next=${encodeURIComponent(next)}`);

  // Check current AAL — if already aal2, they've satisfied MFA, send them through.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect(next);

  // Load their enrolled TOTP factors.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0] ?? null;

  return (
    <MfaWall
      hasFactor={!!totp}
      factorId={totp?.id ?? null}
      next={next}
    />
  );
}
