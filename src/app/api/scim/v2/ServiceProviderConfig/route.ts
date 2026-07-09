import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/scim/v2/ServiceProviderConfig
 * Unauthenticated by spec — IdPs probe this before configuring the connector
 * to see what Forge supports. Declares Users CRUD + PATCH, no Groups/Bulk yet.
 */
export async function GET() {
  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "Bearer Token",
        description: "Authenticate with the SCIM token generated in Forge admin settings.",
        specUri: "https://tools.ietf.org/html/rfc6750",
        primary: true,
      },
    ],
  });
}
