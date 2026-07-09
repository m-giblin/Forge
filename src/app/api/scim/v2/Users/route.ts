import { NextRequest, NextResponse } from "next/server";
import { authenticateScim, listScimUsers, createScimUser } from "@/lib/services/scim";
import { scimError } from "@/lib/api/scimResponse";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

export const runtime = "nodejs";

const LIMIT = 60;
const WINDOW_MS = 60_000;

// Matches Okta/Azure AD's standard pre-provision existence check:
// GET /Users?filter=userName eq "person@company.com"
function parseUserNameFilter(filter: string | null): string | undefined {
  if (!filter) return undefined;
  const m = /userName\s+eq\s+"([^"]+)"/i.exec(filter);
  return m?.[1]?.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const auth = await authenticateScim(req);
  if (!auth.ok) return scimError(auth.status, auth.detail);

  const rl = getRateLimiter();
  const { allowed } = await rl.check(`scim:${auth.tenantId}`, LIMIT, WINDOW_MS);
  if (!allowed) return scimError(429, "Rate limit exceeded.");

  const sp = req.nextUrl.searchParams;
  const startIndex = Math.max(1, parseInt(sp.get("startIndex") ?? "1", 10) || 1);
  const count = Math.min(200, Math.max(1, parseInt(sp.get("count") ?? "100", 10) || 100));
  const filterEmail = parseUserNameFilter(sp.get("filter"));

  const { resources, totalResults } = await listScimUsers(auth.tenantId, { filterEmail, startIndex, count });

  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateScim(req);
  if (!auth.ok) return scimError(auth.status, auth.detail);

  const rl = getRateLimiter();
  const { allowed } = await rl.check(`scim:${auth.tenantId}`, LIMIT, WINDOW_MS);
  if (!allowed) return scimError(429, "Rate limit exceeded.");

  const body = await req.json().catch(() => null);
  const userName = body?.userName?.trim();
  if (!userName) return scimError(400, "userName is required.");

  const displayName: string | undefined =
    body?.displayName ?? ([body?.name?.givenName, body?.name?.familyName].filter(Boolean).join(" ") || undefined);

  const result = await createScimUser(auth.tenantId, { userName, displayName, active: body?.active !== false });
  if (result.conflict) return scimError(409, "A user with this userName already exists in this workspace.");

  return NextResponse.json(result.user, { status: 201 });
}
