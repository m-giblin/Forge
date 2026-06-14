import { z } from "zod";

/**
 * Centralized, validated environment access. All configuration is env-driven
 * (Architecture: "config-driven services") so nothing is hard-coded and the
 * stack stays portable.
 *
 * Two scopes:
 *  - publicEnv()  : safe for the browser (NEXT_PUBLIC_* only).
 *  - serverEnv()  : server-only secrets. Throws if imported where unset.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  IMPERSONATION_SECRET: z.string().optional(),
  AI_PROVIDER: z.string().default("grok"),
  GROK_API_KEY: z.string().optional(),
  RATE_LIMIT_REDIS_URL: z.string().optional(),
});

let _public: z.infer<typeof publicSchema> | null = null;
export function publicEnv() {
  if (_public) return _public;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Missing/invalid public env. Copy .env.example to .env.local and fill Supabase values.\n" +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    );
  }
  _public = parsed.data;
  return _public;
}

let _server: z.infer<typeof serverSchema> | null = null;
export function serverEnv() {
  if (_server) return _server;
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    IMPERSONATION_SECRET: process.env.IMPERSONATION_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    GROK_API_KEY: process.env.GROK_API_KEY,
    RATE_LIMIT_REDIS_URL: process.env.RATE_LIMIT_REDIS_URL,
  });
  if (!parsed.success) {
    throw new Error(
      "Missing/invalid server env.\n" +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    );
  }
  _server = parsed.data;
  return _server;
}
