import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role Supabase client (machine path — API-key requests).
 *
 * ⚠️ This client has BYPASSRLS. RLS policies DO NOT protect you here. Every
 * query made through it MUST be tenant-scoped in code (inject tenant_id). This
 * is the one place isolation lives in the application, not the database
 * (Architecture §5). Never import this into a client component.
 */
export function createSupabaseServiceClient() {
  const pub = publicEnv();
  const srv = serverEnv();
  return createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
