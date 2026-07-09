import { NextRequest, NextResponse } from "next/server";
import { authenticateScim, getScimUser, updateScimUser, deleteScimUser } from "@/lib/services/scim";
import { scimError } from "@/lib/api/scimResponse";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

export const runtime = "nodejs";

const LIMIT = 60;
const WINDOW_MS = 60_000;

async function gate(req: NextRequest) {
  const auth = await authenticateScim(req);
  if (!auth.ok) return { error: scimError(auth.status, auth.detail) };
  const rl = getRateLimiter();
  const { allowed } = await rl.check(`scim:${auth.tenantId}`, LIMIT, WINDOW_MS);
  if (!allowed) return { error: scimError(429, "Rate limit exceeded.") };
  return { tenantId: auth.tenantId };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req);
  if (g.error) return g.error;
  const { id } = await params;

  const user = await getScimUser(g.tenantId!, id);
  if (!user) return scimError(404, "User not found.");
  return NextResponse.json(user);
}

/** PUT — full replace. IdPs vary in what they send; we only apply the fields we model. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req);
  if (g.error) return g.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const displayName: string | undefined =
    body?.displayName ?? ([body?.name?.givenName, body?.name?.familyName].filter(Boolean).join(" ") || undefined);

  const user = await updateScimUser(g.tenantId!, id, { displayName, active: body?.active !== false });
  if (!user) return scimError(404, "User not found.");
  return NextResponse.json(user);
}

/**
 * PATCH — RFC 7644 §3.5.2 partial update. This is how most IdP connectors
 * actually signal deprovisioning: an Operations array with
 * { op: "replace", path: "active", value: false } rather than a DELETE.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req);
  if (g.error) return g.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const ops: Array<{ op: string; path?: string; value?: unknown }> = body?.Operations ?? [];

  const patch: { displayName?: string; active?: boolean } = {};
  for (const op of ops) {
    const opName = op.op?.toLowerCase();
    if (opName !== "replace" && opName !== "add") continue;
    if (op.path === "active" || (op.path === undefined && typeof (op.value as Record<string, unknown>)?.active === "boolean")) {
      const value = op.path === "active" ? op.value : (op.value as Record<string, unknown>).active;
      patch.active = value !== false;
    }
    if (op.path === "displayName") patch.displayName = String(op.value);
  }

  const user = await updateScimUser(g.tenantId!, id, patch);
  if (!user) return scimError(404, "User not found.");
  return NextResponse.json(user);
}

/** DELETE — some connectors deprovision by hard-deleting instead of PATCHing active=false. Same effect: remove the membership. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(req);
  if (g.error) return g.error;
  const { id } = await params;

  const ok = await deleteScimUser(g.tenantId!, id);
  if (!ok) return scimError(404, "User not found.");
  return new Response(null, { status: 204 });
}
