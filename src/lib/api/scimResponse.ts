import { NextResponse } from "next/server";

/** SCIM error responses follow RFC 7644 §3.12 — a distinct shape from Forge's own /api/v1 error format. */
export function scimError(status: number, detail: string) {
  return NextResponse.json(
    { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: String(status), detail },
    { status }
  );
}
