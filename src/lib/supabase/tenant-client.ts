import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tenant-scoped wrapper around the service-role client.
 *
 * The service-role client bypasses RLS entirely — callers MUST inject
 * `tenant_id` manually on every query. Without this wrapper it's trivially
 * easy to forget that filter and silently cross tenant boundaries.
 *
 * Usage:
 *   const tc = tenantClient(tenantId);
 *   const { data } = await tc.from("issues").select("id, title").eq("id", issueId);
 *   await tc.from("issues").update({ title }).eq("id", issueId);
 *   await tc.from("issues").delete().eq("id", issueId);
 *
 * INSERT / UPSERT: caller is responsible for including `tenant_id` in the data.
 * Use `tc.raw` if you need the full Supabase query builder (e.g. insert().select()).
 *
 * Known limitation: generics are loosened compared to the native client.
 * Type-safe column references still work on the chained PostgREST builders.
 */
export function tenantClient(tenantId: string) {
  const svc: SupabaseClient = createSupabaseServiceClient();

  function from(table: string) {
    const qb = svc.from(table);
    return {
      /** SELECT — tenant filter applied automatically */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select(cols?: string): any {
        return qb.select(cols).eq("tenant_id", tenantId);
      },
      /** UPDATE — tenant filter applied automatically; caller chains further .eq() as needed */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update(data: Record<string, unknown>): any {
        return qb.update(data).eq("tenant_id", tenantId);
      },
      /** DELETE — tenant filter applied automatically; caller chains further .eq() as needed */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete(): any {
        return qb.delete().eq("tenant_id", tenantId);
      },
      /**
       * INSERT — caller MUST include tenant_id in the data object(s).
       * The wrapper cannot auto-inject it here without breaking
       * `.insert({...}).select()` chaining.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insert(data: Record<string, unknown> | Record<string, unknown>[]): any {
        return qb.insert(data as object | object[]);
      },
      /**
       * UPSERT — caller MUST include tenant_id in the data object(s).
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upsert(data: Record<string, unknown> | Record<string, unknown>[], opts?: object): any {
        return qb.upsert(data as object | object[], opts);
      },
    };
  }

  return {
    from,
    /** Raw service-role client — use only when the wrapper's API is insufficient. */
    raw: svc,
    /** Auth admin operations (user deletion, etc.) */
    auth: svc.auth,
  };
}
