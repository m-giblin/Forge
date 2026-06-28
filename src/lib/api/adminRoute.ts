import "server-only";
import { NextResponse } from "next/server";
import { requireSuperAdmin, type SuperAdminContext } from "@/lib/super-admin";

/**
 * Wraps a platform-admin API handler to enforce super-admin access.
 *
 * Usage:
 *   export const POST = adminRoute(async (req, sa) => { ... });
 *
 * All new /api/admin/* routes MUST use this wrapper instead of calling
 * requireSuperAdmin() inline — it prevents accidental omission.
 */
export function adminRoute<T extends unknown[]>(
  handler: (req: Request, sa: SuperAdminContext, ...rest: T) => Promise<Response>
) {
  return async (req: Request, ...rest: T): Promise<Response> => {
    const sa = await requireSuperAdmin();
    if (!sa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return handler(req, sa, ...rest);
  };
}
