// SEC-05: the HMAC secret used to sign impersonation ("support view") cookies.
//
// Previously this fell back to SUPABASE_SERVICE_ROLE_KEY when IMPERSONATION_SECRET
// was unset — reusing our most-powerful credential as a signing key, which
// couples blast radius (a leak of either implicates both, and rotating the DB
// key silently breaks impersonation). We now require a DEDICATED secret in
// production and never reuse the service-role key.
//
// Pure + dependency-free so it's unit-testable without the server-only /
// next/headers coupling of impersonation.ts.

export const DEV_IMPERSONATION_SECRET = "dev-only-impersonation-secret-not-for-production";

export function resolveImpersonationSecret(impSecret: string | undefined, isProduction: boolean): string {
  if (impSecret) return impSecret;
  if (isProduction) {
    throw new Error(
      "IMPERSONATION_SECRET is required in production (SEC-05): refusing to sign impersonation cookies with a fallback / the service-role key."
    );
  }
  // Dev/test only — a clearly non-production constant, NOT the service-role key.
  return DEV_IMPERSONATION_SECRET;
}
